import { ORB_HALO_STOPS } from './orb-scene.js';

const CIRCLE_KIND = { HALO: 0, DISC: 1, PARTICLE_GLOW: 2 };
const EDGE_HALF_WIDTH_PX = .65;
const INFALLING_PARTICLE_COLOR = [1, .9059, .4784]; // #ffe77a
const PARTICLE_GLOW = {
  color: [1, .8353, .2902], // #ffd54a
  radiusPadding: 4.5, opacity: .45, falloff: 4.5, fadeStart: .8,
};

// Interleaved floats: CSS position, unit-circle position, RGBA, kind/edge width.
const VERTEX_FIELDS = { position: 2, local: 2, color: 4, shape: 2 };
const FLOATS_PER_VERTEX = Object.values(VERTEX_FIELDS).reduce((sum, size) => sum + size, 0);
const BYTES_PER_FLOAT = Float32Array.BYTES_PER_ELEMENT;
const VERTEX_STRIDE_BYTES = FLOATS_PER_VERTEX * BYTES_PER_FLOAT;
const QUAD_CORNERS = [[-1, -1], [1, -1], [-1, 1], [-1, 1], [1, -1], [1, 1]];
const FLOATS_PER_CIRCLE = QUAD_CORNERS.length * FLOATS_PER_VERTEX;

const glslFloat = value => Number.isInteger(value) ? `${value}.0` : String(value);
function haloGradientSource() {
  const segments = ORB_HALO_STOPS.slice(1).map(([end, endAlpha], index) => {
    const [start, startAlpha] = ORB_HALO_STOPS[index];
    return `if (radius < ${glslFloat(end)}) return mix(${glslFloat(startAlpha)}, ${glslFloat(endAlpha)},
      (radius - ${glslFloat(start)}) / ${glslFloat(end - start)});`;
  });
  return `float haloAlpha(float radius) {
    if (radius <= ${glslFloat(ORB_HALO_STOPS[0][0])}) return ${glslFloat(ORB_HALO_STOPS[0][1])};
    ${segments.join('\n')}
    return ${glslFloat(ORB_HALO_STOPS.at(-1)[1])};
  }`;
}

// Native circles and radial gradients share the background context. All geometry
// is in CSS pixels; the shared renderer alone owns surface density and resources.
export function createOrbLayer(gl, resources, getOrbs) {
  const program = resources.program(`
    attribute vec2 position, local;
    attribute vec4 color;
    attribute vec2 shape;
    uniform vec2 viewport;
    varying vec2 point, style;
    varying vec4 tint;
    void main() {
      gl_Position = vec4(position / viewport * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
      point = local; tint = color; style = shape;
    }`, `precision mediump float;
    varying vec2 point, style;
    varying vec4 tint;
    ${haloGradientSource()}
    void main() {
      float radius = length(point);
      float alpha;
      // Midpoints distinguish the interpolated kind values of each circle.
      if (style.x < ${glslFloat((CIRCLE_KIND.HALO + CIRCLE_KIND.DISC) / 2)}) alpha = haloAlpha(radius);
      else if (style.x > ${glslFloat((CIRCLE_KIND.DISC + CIRCLE_KIND.PARTICLE_GLOW) / 2)}) {
        alpha = exp(-radius * radius * ${glslFloat(PARTICLE_GLOW.falloff)})
          * (1. - smoothstep(${glslFloat(PARTICLE_GLOW.fadeStart)}, 1., radius));
      } else alpha = 1. - smoothstep(1. - style.y, 1. + style.y, radius);
      gl_FragColor = vec4(tint.rgb, tint.a * max(0., alpha));
    }`);
  const buffer = resources.buffer();
  const viewport = gl.getUniformLocation(program, 'viewport');
  let attributeOffset = 0;
  const attributes = Object.entries(VERTEX_FIELDS).map(([name, size]) => {
    const attribute = { location: gl.getAttribLocation(program, name), size, offset: attributeOffset * BYTES_PER_FLOAT };
    attributeOffset += size;
    return attribute;
  });
  let vertices = new Float32Array(FLOATS_PER_CIRCLE);
  return {
    draw(frame) {
      const orbs = getOrbs(frame);
      let floatOffset = 0;
      function appendCircleVertices(x, y, radius, color, alpha, kind = CIRCLE_KIND.DISC) {
        if (alpha <= 0 || radius <= 0) return;
        const required = floatOffset + FLOATS_PER_CIRCLE;
        if (required > vertices.length) {
          // Grow only when needed and retain capacity across subsequent frames.
          const expanded = new Float32Array(Math.max(required, vertices.length * 2));
          expanded.set(vertices.subarray(0, floatOffset));
          vertices = expanded;
        }
        const edge = EDGE_HALF_WIDTH_PX / (radius * frame.pixelRatio);
        const extent = kind === CIRCLE_KIND.DISC ? 1 + edge : 1;
        for (const [u, v] of QUAD_CORNERS) {
          // Write in VERTEX_FIELDS order.
          vertices[floatOffset++] = x + u * radius * extent;
          vertices[floatOffset++] = y + v * radius * extent;
          vertices[floatOffset++] = u * extent;
          vertices[floatOffset++] = v * extent;
          vertices[floatOffset++] = color[0];
          vertices[floatOffset++] = color[1];
          vertices[floatOffset++] = color[2];
          vertices[floatOffset++] = alpha;
          vertices[floatOffset++] = kind;
          vertices[floatOffset++] = edge;
        }
      }
      for (const { x, y, size, opacity, envelopeScale = 1, appearance: { definition, pose } } of orbs) {
        const color = definition.color.match(/\w\w/g).map(value => parseInt(value, 16) / 255);
        const scale = size / definition.size * pose.scale, cx = x + pose.translateX;
        appendCircleVertices(cx, y, definition.haloRadius * scale * pose.pulseScale * envelopeScale, color,
          opacity * definition.haloOpacity * pose.pulseOpacity, CIRCLE_KIND.HALO);
        appendCircleVertices(cx, y, definition.discRadius * scale, color, opacity * definition.discOpacity);
        definition.particles.forEach((particle, i) => {
          const state = pose.particles[i], angle = state.angle * Math.PI / 180;
          const radius = (particle.radius + state.offset) * scale;
          const px = cx + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius;
          const alpha = opacity * pose.particlesOpacity * state.opacity;
          if (particle.infalling) {
            appendCircleVertices(px, py, (particle.size + PARTICLE_GLOW.radiusPadding) * scale,
              PARTICLE_GLOW.color, alpha * PARTICLE_GLOW.opacity, CIRCLE_KIND.PARTICLE_GLOW);
          }
          appendCircleVertices(px, py, particle.size * scale, particle.infalling ? INFALLING_PARTICLE_COLOR : color, alpha);
        });
      }
      if (!floatOffset) return;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices.subarray(0, floatOffset), gl.DYNAMIC_DRAW);
      for (const { location, size, offset } of attributes) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, VERTEX_STRIDE_BYTES, offset);
      }
      gl.uniform2f(viewport, frame.cssWidth, frame.cssHeight);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, floatOffset / FLOATS_PER_VERTEX);
      for (const { location } of attributes) gl.disableVertexAttribArray(location);
    },
  };
}

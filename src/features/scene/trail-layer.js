// A continuous ribbon supplies a .7 CSS-pixel stroke at every surface density.
// Shared vertices prevent dark gaps or doubled alpha at segment/band boundaries.
export function createTrailLayer(gl, resources, scene) {
  const program = resources.program(`
    attribute vec2 position, style;
    uniform vec2 viewport, origin;
    varying vec2 point, stroke;
    void main() {
      gl_Position = vec4((position + origin) / viewport * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
      point = position + origin; stroke = style;
    }`, `precision highp float;
    uniform vec3 discs[4];
    uniform float density, opacity;
    varying vec2 point, stroke;
    void main() {
      float coverage = clamp((.35 - abs(stroke.x)) * density + .5, 0., 1.);
      for (int i = 0; i < 4; i++) {
        coverage *= clamp((distance(point, discs[i].xy) - discs[i].z) * density + .5, 0., 1.);
      }
      gl_FragColor = vec4(162. / 255., 217. / 255., 223. / 255., stroke.y * opacity * coverage);
    }`);
  const buffer = resources.buffer();
  const uniforms = Object.fromEntries(['viewport', 'origin', 'discs[0]', 'density', 'opacity'].map(name => [name, gl.getUniformLocation(program, name)]));
  const position = gl.getAttribLocation(program, 'position'), style = gl.getAttribLocation(program, 'style');
  const vertices = new Float32Array(4 * 128 * 6 * 4), discs = new Float32Array(12);
  const points = new Float32Array(129 * 2), normals = new Float32Array(128 * 2), joins = new Float32Array(129 * 2);
  let lastElapsed, lastWidth, lastHeight, lastDensity, cursor = 0;
  return {
    draw(frame) {
      const { tracks, orbs, bounds, opacity, elapsed } = scene();
      if (!elapsed || !opacity) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      if (elapsed !== lastElapsed || bounds.width !== lastWidth || bounds.height !== lastHeight || frame.pixelRatio !== lastDensity) {
        const extent = .35 + .5 / frame.pixelRatio;
        cursor = 0;
        for (const segments of tracks) {
          for (let i = 0; i <= segments.length; i++) {
            const point = i ? segments[i - 1].end : segments[0].start;
            points[i * 2] = point[0] * bounds.width / 640;
            points[i * 2 + 1] = point[1] * bounds.height / 440;
          }
          for (let i = 0; i < segments.length; i++) {
            const dx = points[i * 2 + 2] - points[i * 2], dy = points[i * 2 + 3] - points[i * 2 + 1];
            const length = Math.hypot(dx, dy) || 1;
            normals[i * 2] = -dy / length; normals[i * 2 + 1] = dx / length;
          }
          for (let i = 0; i <= segments.length; i++) {
            const a = Math.max(0, i - 1) * 2, b = Math.min(i, segments.length - 1) * 2;
            const divisor = 1 + normals[a] * normals[b] + normals[a + 1] * normals[b + 1];
            joins[i * 2] = (normals[a] + normals[b]) / divisor;
            joins[i * 2 + 1] = (normals[a + 1] + normals[b + 1]) / divisor;
          }
          function vertex(index, side) {
            vertices[cursor++] = points[index * 2] + joins[index * 2] * extent * side;
            vertices[cursor++] = points[index * 2 + 1] + joins[index * 2 + 1] * extent * side;
            vertices[cursor++] = extent * side;
            vertices[cursor++] = segments[Math.min(index, segments.length - 1)].opacity;
          }
          for (let i = 0; i < segments.length; i++) {
            vertex(i, -1); vertex(i, 1); vertex(i + 1, -1);
            vertex(i + 1, -1); vertex(i, 1); vertex(i + 1, 1);
          }
        }
        gl.bufferData(gl.ARRAY_BUFFER, vertices.subarray(0, cursor), gl.DYNAMIC_DRAW);
        lastElapsed = elapsed; lastWidth = bounds.width; lastHeight = bounds.height; lastDensity = frame.pixelRatio;
      }
      orbs.forEach(({ x, y, size, appearance: { definition, pose } }, i) => {
        discs[i * 3] = x + pose.translateX; discs[i * 3 + 1] = y;
        discs[i * 3 + 2] = definition.discRadius * size / definition.size * pose.scale;
      });
      gl.useProgram(program);
      gl.enableVertexAttribArray(position); gl.enableVertexAttribArray(style);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(style, 2, gl.FLOAT, false, 16, 8);
      gl.uniform2f(uniforms.viewport, frame.cssWidth, frame.cssHeight);
      gl.uniform2f(uniforms.origin, bounds.x, bounds.y);
      gl.uniform3fv(uniforms['discs[0]'], discs);
      gl.uniform1f(uniforms.density, frame.pixelRatio);
      gl.uniform1f(uniforms.opacity, opacity);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, cursor / 4);
      gl.disableVertexAttribArray(position); gl.disableVertexAttribArray(style);
    },
  };
}

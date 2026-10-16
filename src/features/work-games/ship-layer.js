import { shipAppearance } from './ship-appearance.js';

const number = value => Number.isInteger(value) ? `${value}.0` : String(value);
const rgb = color => color.slice(1, 7).match(/../g).map(value => number(parseInt(value, 16) / 255));
// Signed edge distance supplies native, density-aware antialiasing for the same
// polygon silhouettes as the original artwork. No DOM or rasterized SVG input.
function polygon(points, name) {
  const edges = points.map((a, i) => {
    const b = points[(i + 1) % points.length];
    return `{ vec2 a = vec2(${a.map(number)}), b = vec2(${b.map(number)});
      vec2 edge = b - a, q = p - a;
      d = min(d, length(q - edge * clamp(dot(q, edge) / dot(edge, edge), 0., 1.)));
      if ((a.y > p.y) != (b.y > p.y)) {
        if (p.x < (b.x-a.x) * (p.y-a.y) / (b.y-a.y) + a.x) inside = !inside;
      } }`;
  }).join('\n');
  return `float ${name}(vec2 p) { float d = 1000.; bool inside = false; ${edges} return inside ? -d : d; }`;
}

export function createShipLayer(gl, resources, scene) {
  const padding = 24;
  const width = Math.ceil(shipAppearance.width + padding * 2);
  const height = Math.ceil(shipAppearance.height + padding * 2);
  const [x, y, viewWidth, viewHeight] = shipAppearance.viewBox;
  // Fit and center the viewBox in the declared artwork dimensions.
  const artworkScale = Math.min(shipAppearance.width / viewWidth, shipAppearance.height / viewHeight);
  const origin = [x - (shipAppearance.width / artworkScale - viewWidth) / 2,
    y - (shipAppearance.height / artworkScale - viewHeight) / 2];
  const vertex = `attribute vec2 position;
    uniform vec2 viewport, shipOrigin;
    uniform float worldScale;
    varying vec2 point;
    void main() { point = position; gl_Position = vec4((shipOrigin + point * worldScale) / viewport * vec2(2., -2.) + vec2(-1., 1.), 0., 1.); }`;
  const geometry = shipAppearance.polygons.map((part, i) => polygon(part.points, `part${i}`)).join('\n');
  const hull = resources.program(vertex, `precision highp float;
    varying vec2 point; uniform float edge, opacity, mask;
    ${geometry}
    void main() {
      vec2 p = point / ${number(artworkScale)} + vec2(${origin.map(number)});
      vec4 color = vec4(0.);
      ${shipAppearance.polygons.map((part, i) => {
        const alpha = part.color.length > 7 ? parseInt(part.color.slice(7), 16) / 255 : 1;
        return `{ float a = (1. - smoothstep(-edge, edge, part${i}(p))) * mix(${number(alpha)}, 1., mask);
          color = vec4(mix(color.rgb, vec3(${rgb(part.color)}), a), a + color.a * (1. - a)); }`;
      }).join('\n')}
      gl_FragColor = mask > .5 ? vec4(color.aaa, color.a) : vec4(color.rgb / max(color.a, .0001), color.a * opacity);
    }`);
  const blur = resources.program(`attribute vec2 position; varying vec2 uv;
    void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }`, `precision highp float;
    varying vec2 uv; uniform sampler2D image; uniform vec2 direction;
    void main() { float alpha = 0., total = 0.;
      for (int i = -24; i <= 24; i++) { float weight = exp(-float(i*i) / 128.);
        alpha += texture2D(image, uv + direction * float(i)).a * weight; total += weight; }
      gl_FragColor = vec4(vec3(alpha / total), alpha / total); }`);
  const glow = resources.program(vertex, `precision mediump float; varying vec2 point;
    uniform sampler2D image; uniform float opacity;
    void main() { vec2 uv = (point + vec2(${number(padding)})) / vec2(${number(width)}, ${number(height)});
      float alpha = texture2D(image, vec2(uv.x, 1.-uv.y)).a;
      gl_FragColor = vec4(vec3(${rgb(shipAppearance.glowColor)}), alpha * .7 * opacity); }`);
  const quad = resources.buffer(), screen = resources.buffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-padding,-padding, width-padding,-padding, -padding,height-padding,
    -padding,height-padding, width-padding,-padding, width-padding,height-padding]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, screen);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const textures = [resources.texture(), resources.texture()];
  for (const texture of textures) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  const target = resources.framebuffer();
  const uniforms = new Map([hull, glow, blur].map(program => [program, Object.fromEntries(
    ['viewport', 'shipOrigin', 'worldScale', 'edge', 'opacity', 'mask', 'image', 'direction'].map(name => [name, gl.getUniformLocation(program, name)]))]));
  const attributes = new Map([hull, glow, blur].map(program => [program, gl.getAttribLocation(program, 'position')]));
  function use(program, buffer) {
    gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const location = attributes.get(program);
    gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    return uniforms.get(program);
  }
  function output(texture) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Ship glow target unavailable');
  }
  // Bake only the soft glow, using native geometry and two Gaussian passes.
  // The sharp foreground remains vector geometry at the shared surface density.
  gl.disable(gl.BLEND); gl.viewport(0, 0, width, height); output(textures[0]);
  let uniform = use(hull, quad);
  gl.uniform2f(uniform.viewport, width, height); gl.uniform2f(uniform.shipOrigin, padding, padding);
  gl.uniform1f(uniform.worldScale, 1); gl.uniform1f(uniform.edge, .5 / artworkScale); gl.uniform1f(uniform.mask, 1);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  uniform = use(blur, screen); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(uniform.image, 0);
  for (let axis = 0; axis < 2; axis++) {
    output(textures[1-axis]); gl.bindTexture(gl.TEXTURE_2D, textures[axis]);
    gl.uniform2f(uniform.direction, axis === 0 ? 1 / width : 0, axis === 1 ? 1 / height : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  gl.disableVertexAttribArray(attributes.get(blur)); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return {
    draw(frame) {
      const ship = scene();
      if (!ship || ship.opacity <= 0) return;
      const xRatio = frame.width / frame.cssWidth, yRatio = frame.height / frame.cssHeight;
      const x = Math.round(ship.x * xRatio) / xRatio, y = Math.round(ship.y * yRatio) / yRatio;
      gl.viewport(0, 0, frame.width, frame.height);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      for (const program of [glow, hull]) {
        const u = use(program, quad);
        gl.uniform2f(u.viewport, frame.cssWidth, frame.cssHeight);
        gl.uniform2f(u.shipOrigin, x, y);
        gl.uniform1f(u.worldScale, ship.scale); gl.uniform1f(u.opacity, ship.opacity);
        if (program === glow) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures[0]); gl.uniform1i(u.image, 0); }
        else { gl.uniform1f(u.edge, .5 / (ship.scale * Math.min(xRatio, yRatio) * artworkScale)); gl.uniform1f(u.mask, 0); }
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.disableVertexAttribArray(attributes.get(program));
      }
    },
  };
}

// Battle objects continue to be drawn by the existing Canvas2D view. Composite
// that image before satellites and hull, preserving the original DOM paint order
// without a second WebGL context or a second implementation of combat artwork.
export function createBattleComposite(gl, resources, scene) {
  const program = resources.program(`attribute vec2 position; varying vec2 uv;
    void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }`,
  `precision mediump float; uniform sampler2D image; varying vec2 uv;
    void main() { gl_FragColor = texture2D(image, uv); }`);
  const buffer = resources.buffer(), texture = resources.texture();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const position = gl.getAttribLocation(program, 'position');
  gl.useProgram(program); gl.uniform1i(gl.getUniformLocation(program, 'image'), 0);
  let previousRevision = -1, width = 0, height = 0;
  return {
    draw() {
      const frame = scene();
      if (!frame || frame.canvas.hidden) return;
      const { canvas, revision } = frame;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
      if (revision !== previousRevision) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        if (width !== canvas.width || height !== canvas.height) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
          // Check only allocation/reallocation, never the per-frame update.
          if (gl.getError() !== gl.NO_ERROR) throw new Error('Combat texture allocation failed');
          width = canvas.width; height = canvas.height;
        } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        previousRevision = revision;
      }
      gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disableVertexAttribArray(position);
    },
  };
}

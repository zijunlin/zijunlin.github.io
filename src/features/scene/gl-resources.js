// A resource scope belongs to one shared context. Partial initialization and
// repeated disposal release each allocation exactly once.
export function createResourceScope(gl) {
  const releases = [];
  let disposed = false;
  function own(value, release) {
    if (!value) throw new Error('Graphics resource unavailable');
    if (disposed) { release(value); throw new Error('Graphics scope disposed'); }
    releases.push(() => release(value));
    return value;
  }
  return {
    buffer: () => own(gl.createBuffer(), value => gl.deleteBuffer(value)),
    texture: () => own(gl.createTexture(), value => gl.deleteTexture(value)),
    framebuffer: () => own(gl.createFramebuffer(), value => gl.deleteFramebuffer(value)),
    program(vertex, fragment) {
      const shaders = [];
      try {
        for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
          const shader = gl.createShader(type);
          if (!shader) throw new Error('Shader unavailable');
          shaders.push(shader);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader compilation failed');
        }
        const program = own(gl.createProgram(), value => gl.deleteProgram(value));
        for (const shader of shaders) gl.attachShader(program, shader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader link failed');
        for (const shader of shaders) gl.detachShader(program, shader);
        return program;
      } finally { for (const shader of shaders) gl.deleteShader(shader); }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const release of releases.reverse()) release();
      releases.length = 0;
    },
  };
}

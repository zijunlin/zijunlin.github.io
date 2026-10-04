// Selected A fluid field from the approved visual integration prototype.
const vertexSource = `attribute vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}`;
const fragmentSource = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 resolution;
uniform float time, seed;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*127.5453);}
float noise(vec2 p){vec2 i=floor(p), f=fract(p);f=f*f*(3.0-2.0*f);
return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float field(vec2 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=a*noise(p);p=p*1.91+vec2(3.1,1.7);a*=.5;}return n;}
void main(){
 vec2 uv=gl_FragCoord.xy/resolution;
 vec2 p=(uv-.5)*vec2(resolution.x/resolution.y,1.)*1.1;
 float phase=seed*6.28318;
 float angle=(seed-.5)*.8;
 p=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p;
 float t=time*.045;
 float value=0.;

   vec2 drift=vec2(t*.24,-t*.17);
   vec2 warp=vec2(field(p*1.4+drift+phase),field(p*1.4-drift+phase+4.));
   value=field(p*2.1+warp*1.5+vec2(t*.12,phase));
 float vignette=1.-smoothstep(.3,1.2,length(p))*.4;
 vec3 base=vec3(.039,.067,.102);
 vec3 tint=mix(vec3(.12,.19,.25),vec3(.13,.22,.25),seed);
 gl_FragColor=vec4(base+tint*clamp(value,0.,1.)*vignette,1.);
}`;

// Mix the entry timestamp; clock hours have no visual meaning.
function mixSeed(value) {
  let n = value | 0;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function entrySeed() {
  const supplied = new URLSearchParams(location.search).get('seed');
  if (supplied?.trim() && Number.isFinite(Number(supplied))) {
    return Math.max(0, Math.min(999999, Math.floor(Number(supplied))));
  }
  const timestamp = Date.now();
  try {
    const stored = sessionStorage.getItem('world-entry-seed');
    if (stored?.trim() && Number.isFinite(Number(stored))) return Number(stored);
    sessionStorage.setItem('world-entry-seed', String(timestamp));
  } catch { /* Storage restrictions must not prevent rendering. */ }
  return timestamp;
}

function startBackground(canvas) {
  let gl, program, buffer;
  const shaders = [];
  let frame = 0;
  function fallback() {
    cancelAnimationFrame(frame);
    canvas.hidden = true;
    if (gl) {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
    }
  }

  try {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) return;
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Shader unavailable');
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader compilation failed');
    }
    program = gl.createProgram();
    if (!program) throw new Error('Program unavailable');
    for (const shader of shaders) gl.attachShader(program, shader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader link failed');
    gl.useProgram(program);
    buffer = gl.createBuffer();
    if (!buffer) throw new Error('Buffer unavailable');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, 'resolution');
    const time = gl.getUniformLocation(program, 'time');
    gl.uniform1f(gl.getUniformLocation(program, 'seed'), mixSeed(entrySeed()));
    let elapsed = 0, last = performance.now();
    function draw(now) {
      try {
        const delta = now - last;
        if (delta >= 1000 / 30) {
          last = now;
          if (!document.hidden) {
            elapsed += Math.min(delta / 1000, 0.1) * 0.8;
            const ratio = Math.min(1, 960 / innerWidth, 600 / innerHeight);
            const width = Math.max(1, Math.round(innerWidth * ratio));
            const height = Math.max(1, Math.round(innerHeight * ratio));
            if (canvas.width !== width || canvas.height !== height) {
              canvas.width = width;
              canvas.height = height;
            }
            gl.viewport(0, 0, width, height);
            gl.uniform2f(resolution, width, height);
            gl.uniform1f(time, elapsed);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            if (gl.getError() !== gl.NO_ERROR || gl.isContextLost()) throw new Error('Rendering unavailable');
            canvas.hidden = false;
          }
        }
        frame = requestAnimationFrame(draw);
      } catch { fallback(); }
    }
    canvas.addEventListener('webglcontextlost', fallback, { once: true });
    frame = requestAnimationFrame(draw);
  } catch { fallback(); }
  finally { for (const shader of shaders) gl.deleteShader(shader); }
}

startBackground(document.getElementById('shader-canvas'));

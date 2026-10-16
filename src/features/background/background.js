
// Fluid field for the decorative homepage background.
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
 float t=time*.22;
 float value=0.;

   vec2 drift=vec2(t*.24,-t*.17);
   vec2 warp=vec2(field(p*1.4+drift+phase),field(p*1.4-drift+phase+4.));
   value=field(p*2.1+warp*1.5+vec2(t*.12,phase));
 float vignette=1.-smoothstep(.3,1.2,length(p))*.4;
 vec3 base=vec3(.039,.067,.102);
 vec3 tint=mix(vec3(.12,.19,.25),vec3(.13,.22,.25),seed);
 vec3 color=base+tint*value*vignette;
 // Layer broad veils and fine filaments, reusing the existing noise field.
 float bend=(warp.x-warp.y)*.11;
 float ribbon=uv.y-.46-.17*sin(uv.x*4.2+t*.7+phase)-.07*sin(uv.x*9.-t*.55)-bend;
 float width=11.+4.*sin(uv.x*3.5-t*.4+phase);
 float glow=exp(-abs(ribbon)*width);
 float filament=exp(-abs(ribbon+.035*sin(uv.x*11.-t*.8+phase))*72.);
 float split=exp(-abs(ribbon-.065-.025*sin(uv.x*8.+t*.6))*48.);
 float current=.65+.35*sin(uv.x*6.-t*1.2+value*4.+phase);
 vec3 ribbonTint=mix(vec3(.025,.16,.19),vec3(.09,.12,.23),.5+.5*sin(uv.x*3.-t*.3+phase));
 color+=ribbonTint*glow*(.7+.3*value);
 color+=vec3(.10,.24,.25)*filament*(.22+.3*current);
 color+=vec3(.05,.12,.20)*split*.45;
 // A counterflow above and a diagonal lower veil create depth and crossings.
 float upper=uv.y-.73-.11*sin(uv.x*5.-t*.6+phase)-bend*.6;
 float warm=exp(-abs(upper)*20.);
 float warmThread=exp(-abs(upper+.022*sin(uv.x*13.+t*.7))*80.);
 color+=vec3(.18,.095,.035)*warm*(.35+.25*current);
 color+=vec3(.23,.15,.065)*warmThread*.18;
 float lower=uv.y-.19-uv.x*.15-.10*sin(uv.x*6.+t*.45+phase+2.)+bend;
 float veil=exp(-abs(lower)*14.);
 float thread=exp(-abs(lower-.03*sin(uv.x*10.-t*.65))*60.);
 color+=vec3(.045,.075,.17)*veil*(.5+.3*value);
 color+=vec3(.08,.17,.24)*thread*.25;
 vec2 grid=uv*vec2(resolution.x/resolution.y,1.)*26.;
 vec2 cell=floor(grid);
 vec2 point=fract(grid)-.5;
 float stars=step(.975,hash(cell+seed))*exp(-dot(point,point)*220.);
 color+=vec3(.34,.57,.61)*stars*(.45+.35*sin(t*2.+hash(cell)*25.));
 gl_FragColor=vec4(color,1.);
}`;

// Background allocations and commands use the scene's context and scope.
// Only this pass inherits the previous 960×600 / 30 Hz cost limit.
export function createBackgroundPass(gl, resources, seed) {
  const field = resources.program(vertexSource, fragmentSource);
  const composite = resources.program(vertexSource, `precision mediump float;
    uniform sampler2D background;
    uniform vec2 resolution, scale, offset;
    void main() {
      vec2 uv = (gl_FragCoord.xy / resolution - .5) * scale + .5 - offset;
      gl_FragColor = texture2D(background, uv);
    }`);
  const buffer = resources.buffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const texture = resources.texture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = resources.framebuffer();
  const fieldPosition = gl.getAttribLocation(field, 'position');
  const compositePosition = gl.getAttribLocation(composite, 'position');
  const fieldResolution = gl.getUniformLocation(field, 'resolution');
  const fieldTime = gl.getUniformLocation(field, 'time');
  const compositeResolution = gl.getUniformLocation(composite, 'resolution');
  const compositeScale = gl.getUniformLocation(composite, 'scale');
  const compositeOffset = gl.getUniformLocation(composite, 'offset');
  gl.useProgram(field);
  gl.uniform1f(gl.getUniformLocation(field, 'seed'), seed);
  gl.useProgram(composite);
  gl.uniform1i(gl.getUniformLocation(composite, 'background'), 0);
  let width = 0, height = 0, lastDraw = -Infinity;
  function triangle(program, position) {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  }
  return {
    resize(cssWidth, cssHeight) {
      const ratio = Math.min(1, 960 / cssWidth, 600 / cssHeight);
      const nextWidth = Math.max(1, Math.round(cssWidth * ratio));
      const nextHeight = Math.max(1, Math.round(cssHeight * ratio));
      if (width === nextWidth && height === nextHeight) return;
      width = nextWidth; height = nextHeight;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Background target unavailable');
      lastDraw = -Infinity;
    },
    draw({ now, elapsed, width: outputWidth, height: outputHeight, cssWidth, cssHeight }, offset) {
      gl.disable(gl.BLEND);
      gl.activeTexture(gl.TEXTURE0);
      if (now - lastDraw >= 1000 / 30) {
        lastDraw = now;
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.viewport(0, 0, width, height);
        triangle(field, fieldPosition);
        gl.uniform2f(fieldResolution, width, height);
        gl.uniform1f(fieldTime, elapsed);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, outputWidth, outputHeight);
      triangle(composite, compositePosition);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform2f(compositeResolution, outputWidth, outputHeight);
      // The old 3px overscan and 2px parallax apply only to the cached field.
      gl.uniform2f(compositeScale, cssWidth / (cssWidth + 6), cssHeight / (cssHeight + 6));
      gl.uniform2f(compositeOffset, offset.x / (cssWidth + 6), -offset.y / (cssHeight + 6));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

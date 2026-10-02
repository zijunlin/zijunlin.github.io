// THROWAWAY: three original low-frequency fields, one fullscreen pass, no textures.
const vertexSource = `attribute vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}`;
const fragmentSource = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 resolution;
uniform float time, seed, kind, contrast, scale;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*127.5453);}
float noise(vec2 p){vec2 i=floor(p), f=fract(p);f=f*f*(3.0-2.0*f);
return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float field(vec2 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=a*noise(p);p=p*1.91+vec2(3.1,1.7);a*=.5;}return n;}
void main(){
 vec2 uv=gl_FragCoord.xy/resolution;
 vec2 p=(uv-.5)*vec2(resolution.x/resolution.y,1.)*scale;
 float phase=seed*6.28318;
 float angle=(seed-.5)*.8;
 p=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p;
 float t=time*.045;
 float value=0.;
 if(kind<.5){
   vec2 drift=vec2(t*.24,-t*.17);
   vec2 warp=vec2(field(p*1.4+drift+phase),field(p*1.4-drift+phase+4.));
   value=field(p*2.1+warp*1.5+vec2(t*.12,phase));
 }else if(kind<1.5){
   float axis=p.x*.55+p.y;
   float bend=sin(p.x*1.4+t*.35+phase)*.12;
   for(int i=0;i<3;i++){
     float fi=float(i);float center=(fi-1.)*.62+sin(t*.4+phase+fi)*.12;
     float distance=axis+bend-center;
     value+=exp(-distance*distance*14.)*.3;
   }
 }else{
   for(int i=0;i<4;i++){
     float fi=float(i);float a=phase+fi*1.57;
     vec2 center=vec2(cos(a+t*.18)*.65,sin(a+t*.14)*.42);
     vec2 d=(p-center)*vec2(.85,1.3);
     value+=exp(-dot(d,d)*3.8)*.27;
   }
 }
 float vignette=1.-smoothstep(.3,1.2,length(p))*.4;
 vec3 base=vec3(.039,.067,.102);
 vec3 tint=mix(vec3(.12,.19,.25),vec3(.13,.22,.25),seed);
 gl_FragColor=vec4(base+tint*clamp(value,0.,1.)*contrast*vignette,1.);
}`;
export function createBackground(canvas, onStatus) {
  const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false});
  let program, buffer, uniforms, ready=false;
  function initialize() {
    if(!gl){onStatus('不可用，已静态降级');return;}
    const shaders=[];
    try {
      for(const [type,source] of [[gl.VERTEX_SHADER,vertexSource],[gl.FRAGMENT_SHADER,fragmentSource]]){
        const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error('Shader compile failed');
      }
      program=gl.createProgram();shaders.forEach(shader=>gl.attachShader(program,shader));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader link failed');
      gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
      uniforms=Object.fromEntries(['resolution','time','seed','kind','contrast','scale'].map(name=>[name,gl.getUniformLocation(program,name)]));
      ready=true;canvas.hidden=false;onStatus('动态可用');
    }catch{
      ready=false;canvas.hidden=true;
      if(program)gl.deleteProgram(program);if(buffer)gl.deleteBuffer(buffer);
      onStatus('初始化失败，已静态降级');
    }finally{shaders.forEach(shader=>gl.deleteShader(shader));}
  }
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;canvas.hidden=true;onStatus('背景中断，已静态降级');});
  canvas.addEventListener('webglcontextrestored',initialize);
  initialize();
  return {
    get ready(){return ready;},
    draw(settings,time){
      canvas.hidden=settings.fallback||!ready;
      if(!ready||settings.fallback)return;
      // Limit actual pixels to 1x CSS size and 960x600, independent of device DPR.
      const ratio=Math.min(1,960/canvas.clientWidth,600/canvas.clientHeight);
      const width=Math.max(1,Math.round(canvas.clientWidth*ratio)),height=Math.max(1,Math.round(canvas.clientHeight*ratio));
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      gl.viewport(0,0,width,height);gl.useProgram(program);
      gl.uniform2f(uniforms.resolution,width,height);gl.uniform1f(uniforms.time,time);
      for(const name of ['seed','kind','contrast','scale'])gl.uniform1f(uniforms[name],settings[name]);
      gl.drawArrays(gl.TRIANGLES,0,3);
    },
  };
}

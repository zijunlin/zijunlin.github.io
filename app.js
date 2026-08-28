(() => {
  const canvas = document.querySelector("#world");
  const gl = canvas.getContext("webgl", { antialias:false, alpha:false });
  if (!gl) {
    document.documentElement.classList.add("no-webgl");
    document.querySelectorAll(".reveal").forEach(element => element.classList.add("is-visible"));
    document.querySelector("#year").textContent = new Date().getFullYear();
    return;
  }
  const vertex = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
  const fragment = `precision highp float;uniform vec2 r;uniform vec2 m;uniform float t;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}float fbm(vec2 p){float v=0.,a=.5;mat2 q=mat2(.8,-.6,.6,.8);for(int i=0;i<5;i++){v+=a*noise(p);p=q*p*2.05;a*=.5;}return v;}
  void main(){vec2 uv=(gl_FragCoord.xy-.5*r)/min(r.x,r.y);uv+=(m-.5)*.24;float flow=fbm(uv*2.25+vec2(t*.025,-t*.018));float ridge=smoothstep(.5,.02,abs(uv.y+.13*sin(uv.x*3.2+t*.13)+(flow-.5)*.72));float orb=smoothstep(.62,.02,length(uv-vec2(.39,.02))+(flow-.5)*.14);vec3 base=vec3(.025,.029,.039),blue=vec3(.08,.18,.28),acid=vec3(.48,1.,.14);vec3 col=base+blue*ridge*.54+acid*orb*ridge*.12;col+=acid*pow(max(0.,flow-.62),3.)*.6;float vig=1.-smoothstep(.18,1.05,length(uv));col*=.55+.45*vig;gl_FragColor=vec4(col,1.);}`;
  const makeShader = (type, source) => { const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s); return s; };
  const program=gl.createProgram(); gl.attachShader(program,makeShader(gl.VERTEX_SHADER,vertex)); gl.attachShader(program,makeShader(gl.FRAGMENT_SHADER,fragment)); gl.linkProgram(program); gl.useProgram(program);
  const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,"p"); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const resolution=gl.getUniformLocation(program,"r"), mouseUniform=gl.getUniformLocation(program,"m"), time=gl.getUniformLocation(program,"t");
  let pointer=[.5,.5], target=[.5,.5]; const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  addEventListener("pointermove",e=>{target=[e.clientX/innerWidth,1-e.clientY/innerHeight]}, {passive:true});
  function resize(){const dpr=Math.min(devicePixelRatio,1.75);canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;gl.viewport(0,0,canvas.width,canvas.height)} addEventListener("resize",resize,{passive:true});resize();
  function frame(ms){pointer[0]+=(target[0]-pointer[0])*.035;pointer[1]+=(target[1]-pointer[1])*.035;gl.uniform2f(resolution,canvas.width,canvas.height);gl.uniform2f(mouseUniform,pointer[0],pointer[1]);gl.uniform1f(time,reduced?0:ms*.001);gl.drawArrays(gl.TRIANGLES,0,3);if(!reduced)requestAnimationFrame(frame)} requestAnimationFrame(frame);

  const progress=document.querySelector(".scroll-progress");
  addEventListener("scroll",()=>{const max=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${max?scrollY/max:0})`},{passive:true});
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("is-visible");observer.unobserve(entry.target)}}),{threshold:.13});
  document.querySelectorAll(".reveal").forEach(element=>observer.observe(element));
  document.querySelectorAll(".project-visual").forEach(visual=>{
    visual.addEventListener("pointermove",event=>{const box=visual.getBoundingClientRect();const x=(event.clientX-box.left)/box.width-.5;const y=(event.clientY-box.top)/box.height-.5;visual.style.setProperty("--rx",`${-y*4}deg`);visual.style.setProperty("--ry",`${x*5}deg`)});
    visual.addEventListener("pointerleave",()=>{visual.style.setProperty("--rx","0deg");visual.style.setProperty("--ry","0deg")});
  });
  document.querySelector("#year").textContent=new Date().getFullYear();
})();

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';

const $=id=>document.getElementById(id);
const names={pen:'笔筒',phone:'手机架',cable:'理线器'};
const items={trio:{title:'桌面三件套',desc:'选中并拖动单件器具，靠近接口后松手吸附。每件基座左右侧各有两个磁体；可改变排列顺序、朝向，也可独立摆放。'},pen:{title:'模块化笔筒',desc:'左右侧各有一对磁体，用于与其他基座连接。开放杯身和可拆隔板属于概念结构，尺寸及配合待打样确认。'},phone:{title:'可调手机支架',desc:'拖动模型上的旋钮、转动控制旋钮或使用滑块，自主查看背板倾角变化。旋钮与背板联动仅为概念演示，实际机构与调节范围待验证。'},cable:{title:'卡扣式理线器',desc:'三条开放式卡槽帮助线缆分区，左右侧磁体便于加入不同组合。夹持力、适配线径与疲劳寿命待验证。'}};
const state={ready:false,view:'trio',mode:'move',selected:'phone',angle:20,knobSpin:0,layout:'classic',drag:null,connections:[],snapCandidate:null};
const placements={pen:{x:-.09,z:0,yaw:0},phone:{x:0,z:0,yaw:0},cable:{x:.09,z:0,yaw:0}};
const groups={},knobMeshes=[];let tilt,spin;
const canvas=$('interactiveCanvas'),status=$('status'),mv=$('viewer');
const scene=new THREE.Scene();scene.background=new THREE.Color('#ebece3');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const camera=new THREE.PerspectiveCamera(34,1,.005,10);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.10;controls.enablePan=false;controls.minDistance=.16;controls.maxDistance=1.6;controls.maxPolarAngle=Math.PI/2-.045;
const env=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(env,.04).texture;env.dispose();pmrem.dispose();
const key=new THREE.DirectionalLight(0xfff2df,2.4);key.position.set(-.30,.50,.38);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-.5;key.shadow.camera.right=.5;key.shadow.camera.top=.5;key.shadow.camera.bottom=-.5;key.shadow.camera.near=.01;key.shadow.camera.far=2;key.shadow.normalBias=.0003;key.shadow.bias=-.00005;scene.add(key);
const fill=new THREE.DirectionalLight(0xe5efff,1.1);fill.position.set(.4,.25,-.3);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshStandardMaterial({color:'#ebece3',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.0003;ground.receiveShadow=true;scene.add(ground);
const productRoot=new THREE.Group();productRoot.name='YINXIANGJIA_CURRENT_CONCEPT';productRoot.userData={designStatus:'Concept geometry',dimensionsStatus:'Nominal dimensions unconfirmed',realScaleValidated:false,magneticForceSimulated:false};scene.add(productRoot);
const helpers=new THREE.Group();helpers.name='EDITOR_HELPERS_NOT_EXPORTED';scene.add(helpers);
const ringMaterial=new THREE.LineBasicMaterial({color:'#526d66',transparent:true,opacity:.7});
const selectionRing=new THREE.LineLoop(new THREE.BufferGeometry(),ringMaterial);helpers.add(selectionRing);
const guide=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:'#a7663e',dashSize:.003,gapSize:.002}));guide.visible=false;helpers.add(guide);
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let settlement=null,lastTap=null,animationId=0;
document.querySelectorAll('aside button,.stage-toolbar button').forEach(b=>{if(b.id!=='arButton')b.disabled=true;});

function announce(text){status.textContent=text;}
function resize(){const rect=canvas.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();}
new ResizeObserver(()=>{resize();if(state.ready)fitView(false);}).observe(canvas);
function setMode(mode){state.mode=mode;controls.enabled=true;canvas.style.cursor=mode==='move'&&state.view==='trio'?'grab':'default';}
function fitView(resetDirection=true){
 const box=visibleBounds(),sphere=box.getBoundingSphere(new THREE.Sphere());
 const center=sphere.center.clone();center.y=Math.max(center.y,.04);
 const fov=THREE.MathUtils.degToRad(camera.fov);const vertical=fov/2;const horizontal=Math.atan(Math.tan(vertical)*camera.aspect);
 const distance=Math.max(.30,sphere.radius/Math.sin(Math.min(vertical,horizontal))*1.17);
 const direction=resetDirection?new THREE.Vector3(.53,.48,.78).normalize():camera.position.clone().sub(controls.target).normalize();
 if(!Number.isFinite(direction.x))direction.set(.53,.48,.78).normalize();
 controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,distance);controls.update();
}
function visibleKeys(){return state.view==='trio'?Object.keys(groups):[state.view];}
function applyPlacements(){for(const [key,g]of Object.entries(groups)){g.visible=state.view==='trio'||state.view===key;const p=placements[key];g.position.set(state.view==='trio'?p.x:0,0,state.view==='trio'?p.z:0);g.rotation.y=state.view==='trio'?p.yaw:0;}productRoot.updateMatrixWorld(true);updateHelpers();updateDimensions();}
function selectModule(key){state.selected=key;document.querySelectorAll('[data-module]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.module===key)));updateHelpers();}
function selectView(key){
 if(!state.ready)return;state.view=key;settlement=null;
 document.querySelectorAll('.selector').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.key===key)));
 $('itemName').textContent=items[key].title;$('feature').textContent=items[key].desc;
 $('tiltPanel').hidden=key!=='trio'&&key!=='phone';
 $('stageAngle').hidden=key!=='trio'&&key!=='phone';
 selectModule(key==='trio'?state.selected:key);applyPlacements();fitView();setMode(key==='trio'?'move':'orbit');
 mv.src='yinxiangjia_'+key+'_concept.glb';mv.iosSrc='yinxiangjia_'+key+'_concept.usdz';
 announce(key==='trio'?'拖动器具组合；拖动空白处旋转视角':'模型已载入 · '+(key==='phone'?'拖动旋钮调节倾角':'拖动旋转查看'));
 updateConnections();
}
function setAngle(value,source='slider'){
 state.angle=Math.max(10,Math.min(35,Number(value)));const delta=state.angle-20;
 tilt.rotation.x=-THREE.MathUtils.degToRad(delta);state.knobSpin=THREE.MathUtils.degToRad(delta*6);spin.rotation.x=state.knobSpin;
 $('angleSlider').value=String(Math.round(state.angle));$('angleValue').textContent=Math.round(state.angle)+'°';
 $('stageAngleValue').textContent=Math.round(state.angle)+'°';
 $('rotaryKnob').setAttribute('aria-valuenow',String(Math.round(state.angle)));$('rotaryKnob').setAttribute('aria-valuetext','后倾'+Math.round(state.angle)+'度');
 $('dialIndicator').setAttribute('transform','rotate('+delta*6+' 32 32)');
 productRoot.userData.phoneTiltDeg=state.angle;productRoot.updateMatrixWorld(true);updateDimensions();
 if(source!=='init')announce('旋钮联动演示 · 当前后倾 '+Math.round(state.angle)+'°（非已验证机械行程）');
}
function visibleBounds(){const box=new THREE.Box3();for(const key of visibleKeys())box.union(new THREE.Box3().setFromObject(groups[key],true));return box;}
function updateDimensions(){if(!state.ready)return;const s=visibleBounds().getSize(new THREE.Vector3());$('dimension').textContent='约'+[s.x,s.z,s.y].map(v=>Math.round(v*1000)).join(' × ')+' mm';}
function dimensions(key,yaw=placements[key].yaw){const d=key==='cable'?.042:.09;const c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw));return {x:.09*c+d*s,z:.09*s+d*c};}
function collision(key,pos){
 const a=dimensions(key);
 for(const [other,p]of Object.entries(placements)){if(other===key)continue;const b=dimensions(other);if(Math.abs(pos.x-p.x)<(a.x+b.x)/2-.001&&Math.abs(pos.z-p.z)<(a.z+b.z)/2-.001)return true;}
 return false;
}
function ports(key,pos=placements[key]){
 const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),pos.yaw);
 return [-1,1].map(side=>({side,center:new THREE.Vector3(side*.045,.0046,0).applyQuaternion(q).add(new THREE.Vector3(pos.x,0,pos.z)),normal:new THREE.Vector3(side,0,0).applyQuaternion(q)}));
}
function findSnap(key,radius=.024){
 let best=null;const pa=ports(key);
 for(const [other,p]of Object.entries(placements)){if(other===key)continue;for(const a of pa)for(const b of ports(other)){
  if(a.normal.dot(b.normal)>-.999)continue;const distance=a.center.distanceTo(b.center);if(distance>radius)continue;
  const offset=b.center.clone().sub(a.center);const target={x:placements[key].x+offset.x,z:placements[key].z+offset.z};
  if(collision(key,target))continue;if(!best||distance<best.distance)best={other,distance,target,a:a.center,b:b.center};
 }}return best;
}
function updateConnections(){
 const edges=[];const keys=Object.keys(placements);
 for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++)for(const a of ports(keys[i]))for(const b of ports(keys[j])){
  if(a.normal.dot(b.normal)<-.999&&a.center.distanceTo(b.center)<.001){edges.push([keys[i],keys[j]]);break;}
 }
 state.connections=edges;const unique=edges.filter((e,i)=>edges.findIndex(v=>v[0]===e[0]&&v[1]===e[1])===i);state.connections=unique;
 if($('connectionState'))$('connectionState').textContent=unique.length?'已吸附示意：'+unique.map(e=>names[e[0]]+' ↔ '+names[e[1]]).join('；'):'当前器具已分离，可拖近左右接口重新吸附';
}
function updateHelpers(){
 if(!state.ready)return;const key=state.selected;selectionRing.visible=state.view==='trio';
 const p=placements[key],size=dimensions(key);const dx=size.x/2+.003,dz=size.z/2+.003;
 selectionRing.geometry.dispose();selectionRing.geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p.x-dx,.0008,p.z-dz),new THREE.Vector3(p.x+dx,.0008,p.z-dz),new THREE.Vector3(p.x+dx,.0008,p.z+dz),new THREE.Vector3(p.x-dx,.0008,p.z+dz)]);
}
function clearPreset(){state.layout='custom';document.querySelectorAll('[data-layout]').forEach(b=>b.setAttribute('aria-pressed','false'));}
function settleTo(key,candidate){
 if(!candidate){updateConnections();return false;}
 const start={...placements[key]},end=candidate.target;
 if(reduced){placements[key].x=end.x;placements[key].z=end.z;applyPlacements();updateConnections();}
 else settlement={key,start,end,time:performance.now(),duration:190};
 announce(names[key]+'已靠近'+names[candidate.other]+'的左右磁吸接口');return true;
}
function snapSelected(radius=.13){const key=state.selected;const candidate=findSnap(key,radius);clearPreset();if(!settleTo(key,candidate))announce('未找到方向匹配的空闲接口；请先靠近左右侧，必要时旋转90°');}
function preset(id){
 settlement=null;state.layout=id;
 const layouts={classic:{pen:[-.09,0],phone:[0,0],cable:[.09,0]},'cable-middle':{pen:[-.09,0],phone:[.09,0],cable:[0,0]},pair:{pen:[-.045,-.01],phone:[.045,-.01],cable:[.10,.085]},spread:{pen:[-.12,-.035],phone:[0,.02],cable:[.12,.065]}};
 for(const [key,[x,z]]of Object.entries(layouts[id]))Object.assign(placements[key],{x,z,yaw:0});
 document.querySelectorAll('[data-layout]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layout===id)));
 applyPlacements();updateConnections();fitView(false);announce(id==='spread'?'三件已分离，拖动任意单件重新组合':'组合已切换，可继续拖动、分离或调整手机架倾角');
}
function nudge(dir){
 if(state.view!=='trio')return;const key=state.selected,p=placements[key];const delta={left:[-.015,0],right:[.015,0],front:[0,.015],back:[0,-.015]}[dir];
 const target={x:THREE.MathUtils.clamp(p.x+delta[0],-.23,.23),z:THREE.MathUtils.clamp(p.z+delta[1],-.16,.16)};
 if(collision(key,target)){announce('此处与其他基座重叠；请先分离或换一个方向');return;}
 p.x=target.x;p.z=target.z;clearPreset();applyPlacements();updateConnections();announce(names[key]+'已移动15mm（概念尺寸）');
}
function resetAll(){
 if(!state.ready)return;
 if(state.drag){try{state.drag.element.releasePointerCapture(state.drag.pointerId);}catch{}}
 state.drag=null;state.snapCandidate=null;lastTap=null;settlement=null;guide.visible=false;
 controls.enabled=true;controls.update();selectModule('phone');setAngle(20,'init');preset('classic');selectView('trio');
 announce('已重置：初始三件组合、20°倾角与默认视角');
}
function detach(){
 const key=state.selected,p=placements[key];settlement=null;
 for(const [dx,dz]of [[0,.075],[0,-.075],[.11,0],[-.11,0]]){const target={x:p.x+dx,z:p.z+dz};if(!collision(key,target)){Object.assign(p,target);clearPreset();applyPlacements();updateConnections();fitView(false);announce(names[key]+'已与组合分离');return;}}
}
function rotateSelected(){
 const key=state.selected,p=placements[key],old=p.yaw;p.yaw=(p.yaw+Math.PI/2)%(Math.PI*2);
 if(collision(key,p)){p.yaw=old;announce('旋转后会与其他基座重叠，请先分离所选器具');return;}
 clearPreset();applyPlacements();updateConnections();announce(names[key]+'已旋转90°；吸附仍只发生在左右接口');
}
function ray(event){const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);}
function pick(event){ray(event);const hits=raycaster.intersectObjects(visibleKeys().map(k=>groups[k]),true);return hits[0]||null;}
function moduleOf(object){let o=object;while(o&&o!==productRoot){if(o.userData.moduleKey)return o.userData.moduleKey;o=o.parent;}return null;}
function groundPoint(event){ray(event);return raycaster.ray.intersectPlane(plane,new THREE.Vector3());}
function startKnob(event,element,angular=false){
 event.preventDefault();event.stopPropagation();controls.enabled=false;settlement=null;
 element.setPointerCapture(event.pointerId);const rect=element.getBoundingClientRect();const center={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
 state.drag={type:'knob',pointerId:event.pointerId,element,startY:event.clientY,startAngle:state.angle,angular,center,previous:Math.atan2(event.clientY-center.y,event.clientX-center.x),total:0};
}
function pointerDown(event){
 if(!state.ready||event.button!==0)return;const hit=pick(event);lastTap={x:event.clientX,y:event.clientY,key:hit?moduleOf(hit.object):null};
 if(hit&&/PHONE_(Friction_knob|Knob_slot)/.test(hit.object.name)){selectModule('phone');startKnob(event,canvas,false);return;}
 if(!hit||state.mode!=='move'||state.view!=='trio')return;
 const key=moduleOf(hit.object);if(!key)return;event.preventDefault();event.stopPropagation();selectModule(key);clearPreset();settlement=null;controls.enabled=false;
 const point=groundPoint(event);canvas.setPointerCapture(event.pointerId);
 state.drag={type:'module',key,pointerId:event.pointerId,element:canvas,offset:{x:placements[key].x-point.x,z:placements[key].z-point.z}};canvas.style.cursor='grabbing';
}
function pointerMove(event){
 const drag=state.drag;if(!drag||drag.pointerId!==event.pointerId)return;event.preventDefault();
 if(drag.type==='knob'){
  if(drag.angular){const a=Math.atan2(event.clientY-drag.center.y,event.clientX-drag.center.x);let delta=a-drag.previous;if(delta>Math.PI)delta-=2*Math.PI;if(delta<-Math.PI)delta+=2*Math.PI;drag.total+=delta;drag.previous=a;setAngle(drag.startAngle+THREE.MathUtils.radToDeg(drag.total)/6,'dial');}
  else setAngle(drag.startAngle+(drag.startY-event.clientY)*.16,'model-knob');
  return;
 }
 const point=groundPoint(event);if(!point)return;const p=placements[drag.key];const target={x:THREE.MathUtils.clamp(point.x+drag.offset.x,-.23,.23),z:THREE.MathUtils.clamp(point.z+drag.offset.z,-.16,.16)};
 if(!collision(drag.key,target)){p.x=target.x;p.z=target.z;applyPlacements();updateConnections();}
 const candidate=findSnap(drag.key);state.snapCandidate=candidate;guide.visible=Boolean(candidate);
 if(candidate){guide.geometry.dispose();guide.geometry=new THREE.BufferGeometry().setFromPoints([candidate.a,candidate.b]);guide.computeLineDistances();announce('松手即可与'+names[candidate.other]+'吸附');}
 else announce('正在移动'+names[drag.key]+' · 靠近左右接口后松手');
}
function pointerUp(event){
 const drag=state.drag;
 if(drag&&drag.pointerId===event.pointerId){
  try{drag.element.releasePointerCapture(event.pointerId);}catch{}state.drag=null;controls.enabled=true;guide.visible=false;canvas.style.cursor=state.mode==='move'?'grab':'default';
  if(drag.type==='module'){settleTo(drag.key,findSnap(drag.key));updateConnections();fitView(false);}return;
 }
 if(lastTap&&Math.hypot(event.clientX-lastTap.x,event.clientY-lastTap.y)<5&&lastTap.key)selectModule(lastTap.key);lastTap=null;
}
canvas.addEventListener('pointerdown',pointerDown,{capture:true});
window.addEventListener('pointermove',pointerMove,{passive:false});window.addEventListener('pointerup',pointerUp);window.addEventListener('pointercancel',pointerUp);
$('rotaryKnob').addEventListener('pointerdown',e=>startKnob(e,$('rotaryKnob'),true));
$('rotaryKnob').addEventListener('keydown',e=>{const step={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1}[e.key];if(step){e.preventDefault();setAngle(state.angle+step,'keyboard');}if(e.key==='Home'){e.preventDefault();setAngle(20,'keyboard');}});
$('angleSlider').addEventListener('input',e=>setAngle(e.target.value));$('resetAngle').addEventListener('click',()=>setAngle(20));
document.querySelectorAll('.selector').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.key)));
document.querySelectorAll('[data-layout]').forEach(b=>b.addEventListener('click',()=>preset(b.dataset.layout)));
document.querySelectorAll('[data-module]').forEach(b=>b.addEventListener('click',()=>selectModule(b.dataset.module)));
document.querySelectorAll('[data-nudge]').forEach(b=>b.addEventListener('click',()=>nudge(b.dataset.nudge)));

$('resetAll').addEventListener('click',resetAll);
$('resetView').addEventListener('click',()=>fitView());
canvas.addEventListener('keydown',e=>{const dir={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'back',ArrowDown:'front'}[e.key];if(dir&&state.view==='trio'&&state.mode==='move'){e.preventDefault();nudge(dir);}});

function snapshot(){return {ready:state.ready,view:state.view,selected:state.selected,mode:state.mode,angle:state.angle,knobSpin:state.knobSpin,layout:state.layout,placements:JSON.parse(JSON.stringify(placements)),connections:state.connections.map(e=>[...e]),tiltRotationX:tilt?.rotation.x,visible:visibleKeys(),dimensions:$('dimension').textContent};}
function screenPoint(local,key){const p=groups[key].localToWorld(local.clone()).project(camera);const r=canvas.getBoundingClientRect();return {x:r.left+(p.x*.5+.5)*r.width,y:r.top+(-p.y*.5+.5)*r.height};}
window.productDemo={snapshot,getScreenPoint:(key,point=[0,.008,0])=>screenPoint(new THREE.Vector3(...point),key)};
function exportScene(){
 productRoot.updateMatrixWorld(true);const output=new THREE.Group();output.name='YINXIANGJIA_CURRENT_CONCEPT';
 for(const key of visibleKeys()){const clone=groups[key].clone(true);clone.visible=true;output.add(clone);}
 output.userData={...productRoot.userData,phoneTiltDeg:state.angle,configuration:snapshot().placements,realScaleValidated:false,magnetism:'conceptual placement only'};
 output.updateMatrixWorld(true);return output;
}
function save(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function exportCurrent(format){
 if(!state.ready)return;const button=$(format==='glb'?'exportGLB':'exportUSDZ');button.disabled=true;announce('正在导出当前组合与倾角…');
 try{const output=exportScene();let data;
  if(format==='glb')data=await new GLTFExporter().parseAsync(output,{binary:true,onlyVisible:true});
  else{const exporter=new USDZExporter();data=exporter.parseAsync?await exporter.parseAsync(output):await exporter.parse(output);}
  const blob=new Blob([data],{type:format==='glb'?'model/gltf-binary':'model/vnd.usdz+zip'});save(blob,'yinxiangjia_'+state.view+'_current_concept.'+format);announce('已导出当前构型 · 概念尺寸与机构仍待验证');
 }catch(e){console.error(e);announce('当前构型导出未成功，请重试或使用交付包中的初始模型。');}finally{button.disabled=false;}
}
$('exportGLB').addEventListener('click',()=>exportCurrent('glb'));$('exportUSDZ').addEventListener('click',()=>exportCurrent('usdz'));
mv.addEventListener('load',()=>{$('arButton').disabled=!mv.canActivateAR;$('arButton').textContent=mv.canActivateAR?'AR查看初始模型':'当前设备可使用网页交互';});
mv.addEventListener('error',()=>{$('arButton').disabled=true;$('arButton').textContent='AR初始模型未载入';});
$('arButton').addEventListener('click',async()=>{try{await mv.activateAR();}catch{announce('未能启动AR；可导出USDZ，在支持的设备中查看。');}});

function loop(now){
 animationId=requestAnimationFrame(loop);
 if(settlement){const s=settlement;let t=Math.min(1,(now-s.time)/s.duration);t=1-Math.pow(1-t,3);placements[s.key].x=THREE.MathUtils.lerp(s.start.x,s.end.x,t);placements[s.key].z=THREE.MathUtils.lerp(s.start.z,s.end.z,t);applyPlacements();if(t>=1){settlement=null;updateConnections();}}
 controls.update();scene.updateMatrixWorld(true);
 renderer.render(scene,camera);
}
async function init(){
 try{
  const loader=new GLTFLoader();await Promise.all(Object.keys(names).map(async key=>{
   const asset=await loader.loadAsync('yinxiangjia_'+key+'_concept.glb');const g=asset.scene;g.name=key.toUpperCase()+'_INTERACTIVE_ROOT';g.userData.moduleKey=key;g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});groups[key]=g;productRoot.add(g);
  }));
  const phone=groups.phone;phone.updateMatrixWorld(true);tilt=new THREE.Group();tilt.name='PHONE_INTERACTIVE_TILT_CONCEPT';tilt.position.set(0,.07,-.02);phone.add(tilt);phone.updateMatrixWorld(true);
  const moving=[];phone.traverse(o=>{if(o.isMesh&&/PHONE_(Backplate|Grip_strip|Lower_support_lip|Lip_cushion)/.test(o.name))moving.push(o);});for(const o of moving)tilt.attach(o);
  spin=new THREE.Group();spin.name='PHONE_INTERACTIVE_KNOB_SPIN_CONCEPT';spin.position.set(0,.07,-.02);phone.add(spin);phone.updateMatrixWorld(true);
  phone.traverse(o=>{if(o.isMesh&&/PHONE_(Friction_knob|Knob_slot)/.test(o.name))knobMeshes.push(o);});for(const o of knobMeshes)spin.attach(o);
  state.ready=true;document.querySelectorAll('aside button,.stage-toolbar button').forEach(b=>{if(b.id!=='arButton')b.disabled=false;});resize();setAngle(20,'init');applyPlacements();updateConnections();fitView();setMode('move');announce('模型已载入 · 拖动单件组合，转动旋钮调节倾角');loop(performance.now());
 }catch(e){console.error(e);$('loadError').hidden=false;$('loadError').textContent='交互模型未能加载。请检查网络并刷新；也可从交付包中打开原始模型。';announce('交互加载失败，请刷新重试');}
}
init();

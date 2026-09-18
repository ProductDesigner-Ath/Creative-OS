export class ProtocolError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = message => { throw new ProtocolError('INVALID_REQUEST', message); };
function keys(obj, expected) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || Object.keys(obj).sort().join(',') !== [...expected].sort().join(',')) fail('Unexpected or missing fields');
}
export function validateRequest(r) {
  keys(r,['version','requestId','app','operation','arguments']);
  if (r.version !== '0.1' || r.app !== 'after_effects') fail('Unsupported version or app');
  if (typeof r.requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(r.requestId)) fail('requestId must be a lowercase UUID');
  const a=r.arguments;
  switch(r.operation) {
    case 'composition.create': keys(a,['name','width','height','duration','frameRate']); break;
    case 'layer.createSolid': keys(a,['context','compositionId','name','width','height','color']); break;
    case 'layer.createRectangle': keys(a,['context','compositionId','name','width','height','position','color']); break;
    case 'layer.createEllipse': keys(a,['context','compositionId','name','width','height','position','color']); break;
    case 'composition.getActive': keys(a,[]); break;
    case 'composition.openById': keys(a,['compositionId']); break;
    case 'composition.getLayers': keys(a,['context','compositionId']); break;
    case 'composition.getState': keys(a,['context','compositionId']); break;
    case 'composition.setCurrentFrame': keys(a,['context','compositionId','frame']); break;
    case 'composition.getVisibleLayersAtFrame': keys(a,['context','compositionId','frame']); break;
    case 'composition.getMarkers': keys(a,['context','compositionId']); break;
    case 'composition.addMarker': keys(a,['context','compositionId','frame','comment']); break;
    case 'project.importAsset': keys(a,['context','compositionId','assetPath']); break;
    case 'layer.addProjectItem': keys(a,['context','compositionId','itemId','position','scale']); break;
    case 'layer.setTrackMatte': keys(a,['context','compositionId','layerId','matteLayerId','type']); break;
    case 'layer.addRectMask': keys(a,['context','compositionId','layerId','x','y','width','height']); break;
    case 'layer.animateRectMask': keys(a,['context','compositionId','layerId','maskIndex','keyframes']); break;
    case 'layer.setMaskFeather': keys(a,['context','compositionId','layerId','maskIndex','feather']); break;
    case 'text.addOpacityReveal': keys(a,['context','compositionId','layerId','startTime','endTime']); break;
    case 'layer.setBlendMode': keys(a,['context','compositionId','layerId','mode']); break;
    case 'text.addTrackingReveal': keys(a,['context','compositionId','layerId','startTime','endTime','tracking']); break;
    case 'layer.setTemporalEase': keys(a,['context','compositionId','layerId','property','influence']); break;
    case 'text.addPositionReveal': keys(a,['context','compositionId','layerId','startTime','endTime','offset']); break;
    case 'layer.animateMaskFeather': keys(a,['context','compositionId','layerId','maskIndex','keyframes']); break;
    case 'layer.addGaussianBlur': keys(a,['context','compositionId','layerId','blurriness']); break;
    case 'layer.getTransform': keys(a,['context','compositionId','layerId']); break;
    case 'layer.getSourceInfo': keys(a,['context','compositionId','layerId']); break;
    case 'layer.getTextDocument': keys(a,['context','compositionId','layerId']); break;
    case 'layer.setTextStyle': keys(a,['context','compositionId','layerId','fontSize','fillColor','justification']); break;
    case 'layer.getAnimationState': keys(a,['context','compositionId','layerId']); break;
    case 'layer.setParent': keys(a,['context','compositionId','layerId','parentLayerId']); break;
    case 'layer.moveBefore': keys(a,['context','compositionId','layerId','targetLayerId']); break;
    case 'layer.createText': keys(a,['context','compositionId','text']); break;
    case 'layer.getPosition': keys(a,['context','compositionId','layerId']); break;
    case 'layer.setPosition': keys(a,['context','compositionId','layerId','value']); break;
    case 'layer.addPositionKeyframes': keys(a,['context','compositionId','layerId','keyframes']); break;
    case 'layer.addOpacityKeyframes': keys(a,['context','compositionId','layerId','keyframes']); break;
    case 'layer.addTransformKeyframes': keys(a,['context','compositionId','layerId','property','keyframes']); break;
    case 'layer.addAnchorPointKeyframes': keys(a,['context','compositionId','layerId','keyframes']); break;
    case 'layer.setTiming': keys(a,['context','compositionId','layerId','inPoint','outPoint']); break;
    case 'layer.setBezierKeyframes': keys(a,['context','compositionId','layerId','property']); break;
    case 'layer.getKeyframes': keys(a,['context','compositionId','layerId','property']); break;
    default: fail('Operation is not allowlisted');
  }
  if (r.operation === 'composition.create') { if(typeof a.name!=='string'||!a.name.length||a.name.length>100) fail('Invalid name'); if(![a.width,a.height,a.duration,a.frameRate].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0)) fail('Invalid composition settings'); return r; }
  if (r.operation === 'layer.createSolid') { if(typeof a.name!=='string'||!a.name.length||a.name.length>100||![a.width,a.height].every(v=>Number.isFinite(v)&&v>0)||!Array.isArray(a.color)||a.color.length!==3||!a.color.every(v=>Number.isFinite(v)&&v>=0&&v<=1)) fail('Invalid solid settings'); }
  if (r.operation === 'layer.createRectangle') { if(typeof a.name!=='string'||!a.name.length||![a.width,a.height].every(v=>Number.isFinite(v)&&v>0)||!Array.isArray(a.position)||a.position.length!==2||!a.position.every(Number.isFinite)||!Array.isArray(a.color)||a.color.length!==3||!a.color.every(v=>Number.isFinite(v)&&v>=0&&v<=1)) fail('Invalid rectangle settings'); }
  if (r.operation === 'layer.createEllipse') { if(typeof a.name!=='string'||!a.name.length||![a.width,a.height].every(v=>Number.isFinite(v)&&v>0)||!Array.isArray(a.position)||a.position.length!==2||!a.position.every(Number.isFinite)||!Array.isArray(a.color)||a.color.length!==3||!a.color.every(v=>Number.isFinite(v)&&v>=0&&v<=1)) fail('Invalid ellipse settings'); }
  if (r.operation !== 'composition.getActive' && r.operation !== 'composition.openById') {
    if (typeof a.context !== 'string' || !/^[a-f0-9-]{36}$/.test(a.context)) fail('Invalid context');
    if (!Number.isSafeInteger(a.compositionId) || a.compositionId < 1) fail('Invalid compositionId');
  }
  if (r.operation === 'composition.openById' && (!Number.isSafeInteger(a.compositionId) || a.compositionId < 1)) fail('Invalid compositionId');
  if ('layerId' in a && (!Number.isSafeInteger(a.layerId) || a.layerId < 1)) fail('Invalid layerId');
  if (r.operation === 'layer.setParent' && (!Number.isSafeInteger(a.parentLayerId) || a.parentLayerId < 1 || a.parentLayerId === a.layerId)) fail('Invalid parentLayerId');
  if (r.operation === 'layer.moveBefore' && (!Number.isSafeInteger(a.targetLayerId) || a.targetLayerId < 1 || a.targetLayerId === a.layerId)) fail('Invalid targetLayerId');
  if ((r.operation === 'composition.setCurrentFrame' || r.operation === 'composition.getVisibleLayersAtFrame' || r.operation === 'composition.addMarker') && (!Number.isSafeInteger(a.frame) || a.frame < 0 || a.frame > 1000000)) fail('Frame must be a nonnegative safe integer');
  if (r.operation === 'composition.addMarker' && (typeof a.comment !== 'string' || !a.comment.length || a.comment.length > 100 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(a.comment))) fail('Marker comment must contain 1–100 characters without control codes');
  if (r.operation === 'project.importAsset' && (typeof a.assetPath !== 'string' || !/^(?:[A-Za-z0-9 _.-]+\\)*[A-Za-z0-9 _.-]+\.(?:png|jpg|jpeg|mp4|ai)$/i.test(a.assetPath) || /(^|\\)\.\.?($|\\)/.test(a.assetPath))) fail('Asset path must be a safe relative approved-media path');
  if (r.operation === 'layer.addProjectItem' && (!Number.isSafeInteger(a.itemId) || a.itemId < 1 || !Array.isArray(a.position) || a.position.length !== 2 || !a.position.every(v=>Number.isFinite(v) && Math.abs(v)<=100000) || !Array.isArray(a.scale) || a.scale.length !== 2 || !a.scale.every(v=>Number.isFinite(v) && v>0 && v<=10000))) fail('Invalid project-item layer placement');
  if (r.operation === 'layer.setTrackMatte' && (!Number.isSafeInteger(a.matteLayerId) || a.matteLayerId < 1 || a.matteLayerId === a.layerId || !['alpha','alphaInverted','luma','lumaInverted'].includes(a.type))) fail('Invalid track matte settings');
  if (r.operation === 'layer.addRectMask' && ![a.x,a.y,a.width,a.height].every(v=>Number.isFinite(v) && Math.abs(v)<=100000) || r.operation === 'layer.addRectMask' && (a.width<=0 || a.height<=0)) fail('Invalid rectangular mask bounds');
  if (r.operation === 'layer.animateRectMask' && (!Number.isSafeInteger(a.maskIndex) || a.maskIndex<1 || !Array.isArray(a.keyframes) || a.keyframes.length!==2 || !a.keyframes.every(k=>k && Number.isFinite(k.time) && k.time>=0 && [k.x,k.y,k.width,k.height].every(v=>Number.isFinite(v) && Math.abs(v)<=100000) && k.width>0 && k.height>0) || a.keyframes[1].time<=a.keyframes[0].time)) fail('Invalid rectangular mask keyframes');
  if (r.operation === 'layer.setMaskFeather' && (!Number.isSafeInteger(a.maskIndex) || a.maskIndex<1 || !Array.isArray(a.feather) || a.feather.length!==2 || !a.feather.every(v=>Number.isFinite(v) && v>=0 && v<=10000))) fail('Invalid mask feather');
  if (r.operation === 'text.addOpacityReveal' && (![a.startTime,a.endTime].every(v=>Number.isFinite(v) && v>=0) || a.endTime<=a.startTime)) fail('Invalid text reveal timing');
  if (r.operation === 'layer.setBlendMode' && !['normal','multiply','screen','add'].includes(a.mode)) fail('Unsupported blend mode');
  if (r.operation === 'text.addTrackingReveal' && (![a.startTime,a.endTime, a.tracking].every(v=>Number.isFinite(v)) || a.startTime<0 || a.endTime<=a.startTime || Math.abs(a.tracking)>1000)) fail('Invalid tracking reveal settings');
  if (r.operation === 'layer.setTemporalEase' && (!['position','opacity','scale','rotation'].includes(a.property) || !Number.isFinite(a.influence) || a.influence<0.1 || a.influence>100)) fail('Invalid temporal ease settings');
  if (r.operation === 'text.addPositionReveal' && (![a.startTime,a.endTime].every(v=>Number.isFinite(v) && v>=0) || a.endTime<=a.startTime || !Array.isArray(a.offset) || a.offset.length!==2 || !a.offset.every(v=>Number.isFinite(v) && Math.abs(v)<=10000))) fail('Invalid text position reveal');
  if (r.operation === 'layer.animateMaskFeather' && (!Number.isSafeInteger(a.maskIndex) || a.maskIndex<1 || !Array.isArray(a.keyframes) || a.keyframes.length!==2 || !a.keyframes.every(k=>k && Number.isFinite(k.time) && k.time>=0 && Array.isArray(k.value) && k.value.length===2 && k.value.every(v=>Number.isFinite(v) && v>=0 && v<=10000)) || a.keyframes[1].time<=a.keyframes[0].time)) fail('Invalid mask feather keyframes');
  if (r.operation === 'layer.addGaussianBlur' && (!Number.isFinite(a.blurriness) || a.blurriness<0 || a.blurriness>500)) fail('Invalid Gaussian blur amount');
  if ('text' in a && (typeof a.text !== 'string' || !a.text.length || a.text.length > 200 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(a.text))) fail('Text must contain 1–200 characters without control codes');
  if (r.operation === 'layer.setTextStyle' && (!Number.isFinite(a.fontSize) || a.fontSize < 1 || a.fontSize > 1000 || !Array.isArray(a.fillColor) || a.fillColor.length !== 3 || !a.fillColor.every(v => Number.isFinite(v) && v >= 0 && v <= 1) || !['left','center','right'].includes(a.justification))) fail('Invalid text style settings');
  if ('value' in a && (!Array.isArray(a.value) || ![2,3].includes(a.value.length) || !a.value.every(v=>typeof v==='number' && Number.isFinite(v) && Math.abs(v)<=100000))) fail('Position must contain 2 or 3 finite numbers within +/-100000');
  if (r.operation === 'layer.setTiming' && (![a.inPoint,a.outPoint].every(v=>typeof v==='number' && Number.isFinite(v) && v>=0) || a.outPoint<=a.inPoint)) fail('Timing requires nonnegative increasing inPoint and outPoint');
  if ('property' in a && !['position','opacity','scale','rotation'].includes(a.property)) fail('Property is not allowlisted');
  if (r.operation === 'layer.setBezierKeyframes' && !['position','opacity','scale','rotation','anchorPoint'].includes(a.property)) fail('Property is not allowlisted');
  if (r.operation === 'layer.addTransformKeyframes' && !['scale','rotation'].includes(a.property)) fail('Transform property is not allowlisted');
  if ('keyframes' in a && r.operation !== 'layer.animateRectMask' && r.operation !== 'layer.animateMaskFeather' && (!Array.isArray(a.keyframes) || a.keyframes.length !== 2 || !a.keyframes.every(k=>k && Number.isFinite(k.time) && k.time>=0 && Array.isArray(k.value) && k.value.every(v=>Number.isFinite(v))))) fail('Exactly two finite keyframes are required');
  return r;
}
export function failure(requestId, code, message, extra={}) {
  return {version:'0.1',requestId:requestId ?? null,success:false,error:{code,message,...extra}};
}

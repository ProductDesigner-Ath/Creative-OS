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
    case 'composition.getActive': keys(a,[]); break;
    case 'composition.getLayers': keys(a,['context','compositionId']); break;
    case 'composition.getState': keys(a,['context','compositionId']); break;
    case 'layer.getTransform': keys(a,['context','compositionId','layerId']); break;
    case 'layer.getSourceInfo': keys(a,['context','compositionId','layerId']); break;
    case 'layer.getTextDocument': keys(a,['context','compositionId','layerId']); break;
    case 'layer.getAnimationState': keys(a,['context','compositionId','layerId']); break;
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
  if (r.operation !== 'composition.getActive') {
    if (typeof a.context !== 'string' || !/^[a-f0-9-]{36}$/.test(a.context)) fail('Invalid context');
    if (!Number.isSafeInteger(a.compositionId) || a.compositionId < 1) fail('Invalid compositionId');
  }
  if ('layerId' in a && (!Number.isSafeInteger(a.layerId) || a.layerId < 1)) fail('Invalid layerId');
  if ('text' in a && (typeof a.text !== 'string' || !a.text.length || a.text.length > 200 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(a.text))) fail('Text must contain 1–200 characters without control codes');
  if ('value' in a && (!Array.isArray(a.value) || ![2,3].includes(a.value.length) || !a.value.every(v=>typeof v==='number' && Number.isFinite(v) && Math.abs(v)<=100000))) fail('Position must contain 2 or 3 finite numbers within +/-100000');
  if (r.operation === 'layer.setTiming' && (![a.inPoint,a.outPoint].every(v=>typeof v==='number' && Number.isFinite(v) && v>=0) || a.outPoint<=a.inPoint)) fail('Timing requires nonnegative increasing inPoint and outPoint');
  if ('property' in a && !['position','opacity','scale','rotation'].includes(a.property)) fail('Property is not allowlisted');
  if (r.operation === 'layer.setBezierKeyframes' && !['position','opacity','scale','rotation','anchorPoint'].includes(a.property)) fail('Property is not allowlisted');
  if (r.operation === 'layer.addTransformKeyframes' && !['scale','rotation'].includes(a.property)) fail('Transform property is not allowlisted');
  if ('keyframes' in a && (!Array.isArray(a.keyframes) || a.keyframes.length !== 2 || !a.keyframes.every(k=>k && Number.isFinite(k.time) && k.time>=0 && Array.isArray(k.value) && k.value.every(v=>Number.isFinite(v))))) fail('Exactly two finite keyframes are required');
  return r;
}
export function failure(requestId, code, message, extra={}) {
  return {version:'0.1',requestId:requestId ?? null,success:false,error:{code,message,...extra}};
}

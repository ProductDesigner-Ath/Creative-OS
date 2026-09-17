export function validate(events, runId) {
  const expected = ['start','get_active_comp','create_text_layer','read_position','set_position','undo','complete'];
  const errors = [];
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  if (!same(events.map(x=>x.event),expected)) errors.push('Missing, duplicate, failed, or out-of-order operations');
  if (events.some(x=>x.runId !== runId)) errors.push('Run ID mismatch');
  const data = name => events.find(x=>x.event===name)?.data;
  const comp=data('get_active_comp'), layer=data('create_text_layer'), read=data('read_position'), set=data('set_position'), undo=data('undo');
  if (!comp || !Number.isFinite(comp.id) || !Array.isArray(comp.layerIds)) errors.push('Invalid composition evidence');
  if (!layer || !Number.isFinite(layer.id) || layer.text !== 'Creative OS') errors.push('Invalid text evidence');
  if (!read || read.layerId !== layer?.id || !Array.isArray(read.value) || ![2,3].includes(read.value.length) || !read.value.every(Number.isFinite)) errors.push('Invalid position evidence');
  if (!set || set.layerId !== layer?.id || !same(set.before,read?.value) || !same(set.requested,set.actual) || !same(set.requested,read?.value?.map((v,i)=>v+(i===0?120:i===1?60:0)))) errors.push('Position set/readback mismatch');
  if (!undo || undo.removedLayerId !== layer?.id || undo.restored !== true || !same(undo.beforeLayerIds,comp?.layerIds) || !same(undo.afterLayerIds,comp?.layerIds) || undo.afterLayerIds?.includes(layer?.id)) errors.push('Undo did not restore original layer IDs');
  if (data('complete')?.pass !== true || data('complete')?.operations !== 5) errors.push('AE did not report five successful operations');
  return {runId,pass:errors.length===0,errors,host:data('start'),operations:expected.slice(1,-1)};
}

import readline from 'node:readline';
import {randomUUID} from 'node:crypto';
import {command} from '../local-bridge/client.mjs';
import {validateRequest} from '../../packages/protocol/index.mjs';

const tools=[
  {name:'ae_get_active_composition',description:'Read the active After Effects composition and issue a short-lived context token.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'ae_get_layers',description:'Read ordered layer IDs, names, timing, flags, and host match names from the active composition.',inputSchema:{type:'object',required:['context','compositionId'],properties:{context:{type:'string'},compositionId:{type:'integer'}},additionalProperties:false}},
  {name:'ae_get_composition_state',description:'Read composition dimensions, timing, frame rate, current time, and work area.',inputSchema:{type:'object',required:['context','compositionId'],properties:{context:{type:'string'},compositionId:{type:'integer'}},additionalProperties:false}},
  {name:'ae_create_text_layer',description:'Create an editable text layer in the active composition. The change remains visible.',inputSchema:{type:'object',required:['context','compositionId','text'],properties:{context:{type:'string'},compositionId:{type:'integer'},text:{type:'string'}},additionalProperties:false}},
  {name:'ae_get_position',description:'Read a layer Position value.',inputSchema:{type:'object',required:['context','compositionId','layerId'],properties:{context:{type:'string'},compositionId:{type:'integer'},layerId:{type:'integer'}},additionalProperties:false}},
  {name:'ae_get_transform',description:'Read Anchor Point, Position, Scale, Rotation, Opacity, and 3D status for a layer.',inputSchema:{type:'object',required:['context','compositionId','layerId'],properties:{context:{type:'string'},compositionId:{type:'integer'},layerId:{type:'integer'}},additionalProperties:false}},
  {name:'ae_get_source_info',description:'Read whether a layer is text, footage, or a nested composition and identify its source.',inputSchema:{type:'object',required:['context','compositionId','layerId'],properties:{context:{type:'string'},compositionId:{type:'integer'},layerId:{type:'integer'}},additionalProperties:false}},
  {name:'ae_get_text_document',description:'Read the text content and basic styling of a text layer.',inputSchema:{type:'object',required:['context','compositionId','layerId'],properties:{context:{type:'string'},compositionId:{type:'integer'},layerId:{type:'integer'}},additionalProperties:false}},
  {name:'ae_get_animation_state',description:'Read current transform values and all keyframes for Anchor Point, Position, Scale, Rotation, and Opacity.',inputSchema:{type:'object',required:['context','compositionId','layerId'],properties:{context:{type:'string'},compositionId:{type:'integer'},layerId:{type:'integer'}},additionalProperties:false}},
  {name:'ae_set_position',description:'Set a static layer Position. The change remains visible; no undo is performed.',inputSchema:{type:'object',required:['context','compositionId','layerId','value'],properties:{context:{type:'string'},compositionId:{type:'integer'},layerId:{type:'integer'},value:{type:'array',items:{type:'number'}}},additionalProperties:false}},
  {name:'ae_add_position_keyframes',description:'Add exactly two Position keyframes to a layer.',inputSchema:{type:'object',required:['context','compositionId','layerId','keyframes'],properties:{context:{type:'string'},compositionId:{type:'integer'},layerId:{type:'integer'},keyframes:{type:'array',minItems:2,maxItems:2}},additionalProperties:false}},
  {name:'ae_add_opacity_keyframes',description:'Add exactly two Opacity keyframes to a layer.',inputSchema:{type:'object',required:['context','compositionId','layerId','keyframes'],properties:{context:{type:'string'},compositionId:{type:'integer'},layerId:{type:'integer'},keyframes:{type:'array',minItems:2,maxItems:2}},additionalProperties:false}},
  {name:'ae_get_keyframes',description:'Read Position or Opacity keyframes from a layer.',inputSchema:{type:'object',required:['context','compositionId','layerId','property'],properties:{context:{type:'string'},compositionId:{type:'integer'},layerId:{type:'integer'},property:{type:'string',enum:['position','opacity']}},additionalProperties:false}}
];
const operationByTool={ae_get_active_composition:['composition.getActive',{}],ae_get_layers:['composition.getLayers'],ae_get_composition_state:['composition.getState'],ae_create_text_layer:['layer.createText'],ae_get_position:['layer.getPosition'],ae_get_transform:['layer.getTransform'],ae_get_source_info:['layer.getSourceInfo'],ae_get_text_document:['layer.getTextDocument'],ae_get_animation_state:['layer.getAnimationState'],ae_set_position:['layer.setPosition'],ae_add_position_keyframes:['layer.addPositionKeyframes'],ae_add_opacity_keyframes:['layer.addOpacityKeyframes'],ae_get_keyframes:['layer.getKeyframes']};
function result(id,body){return {jsonrpc:'2.0',id,result:body};}
function error(id,code,message){return {jsonrpc:'2.0',id,error:{code,message}};}
async function handle(msg){
  if(msg.jsonrpc!=='2.0' || msg.id===undefined) return null;
  if(msg.method==='initialize') return result(msg.id,{protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'creative-os-local-mcp',version:'0.1.0'}});
  if(msg.method==='notifications/initialized') return null;
  if(msg.method==='tools/list') return result(msg.id,{tools});
  if(msg.method!=='tools/call') return error(msg.id,-32601,'Method not found');
  const name=msg.params?.name, spec=operationByTool[name];
  if(!spec) return error(msg.id,-32602,'Tool is not allowlisted');
  const args=msg.params?.arguments ?? {};
  try {
    const [operation, fixed]=spec;
    const requestId=randomUUID();
    const request={version:'0.1',requestId,app:'after_effects',operation,arguments:{...fixed,...args}};
    validateRequest(request);
    const response=await command(operation,request.arguments,requestId);
    return result(msg.id,{content:[{type:'text',text:JSON.stringify(response)}],structuredContent:response,isError:!response.success});
  } catch(e) { return error(msg.id,-32602,e.message); }
}
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
for await(const line of rl) { if(!line.trim()) continue; let msg; try {msg=JSON.parse(line);} catch(e) {process.stdout.write(JSON.stringify(error(null,-32700,'Invalid JSON'))+'\n');continue;} const reply=await handle(msg); if(reply) process.stdout.write(JSON.stringify(reply)+'\n'); }

/* Trusted, fixed command adapter. User text is data; never eval'd. */
(function () {
    var cfg = __COMMAND_CONFIG__, r = cfg.request, a = r.arguments;
    var group = false, changed = false, createdId = null;
    function encode(v) {
        if (v === null || v === undefined) return 'null';
        if (typeof v === 'string') return '"' + v.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/[\x00-\x1f]/g,function(c){return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);}) + '"';
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        var out=[],k;
        if (v instanceof Array) { for(k=0;k<v.length;k++) out.push(encode(v[k])); return '['+out.join(',')+']'; }
        for(k in v) if(v.hasOwnProperty(k)) out.push(encode(k)+':'+encode(v[k]));
        return '{'+out.join(',')+'}';
    }
    function fail(code,message) { var e=new Error(message); e.code=code; throw e; }
    function write(file,value) {
        var f=new File(file); f.encoding='UTF-8';
        if(!f.open('w')) fail('LOG_UNAVAILABLE','Cannot open result log');
        var ok=f.writeln(encode(value)); f.close();
        if(!ok) fail('LOG_UNAVAILABLE','Cannot write result log');
    }
    function position(layer) { return layer.property('ADBE Transform Group').property('ADBE Position'); }
    var response={version:'0.1',requestId:r.requestId,success:false};
    try {
        write(cfg.startedPath,{requestId:r.requestId,started:true,version:app.version});
        var comp=app.project && app.project.activeItem;
        if(!(comp instanceof CompItem)) fail('NO_ACTIVE_COMPOSITION','Open a composition in AE.');
        var ctx=$.global.__creativeOSContext;
        if(r.operation==='composition.getActive') {
            ctx={token:cfg.contextToken,project:app.project,comp:comp};
            $.global.__creativeOSContext=ctx;
            response.result={context:ctx.token,compositionId:comp.id,name:comp.name,width:comp.width,height:comp.height,layerCount:comp.numLayers,version:app.version};
        } else if(r.operation==='composition.getLayers') {
            if(!ctx || ctx.token!==a.context || ctx.project!==app.project || ctx.comp!==comp || comp.id!==a.compositionId) fail('STALE_CONTEXT','Active project or composition changed; query the active composition again.');
            var layers=[], li, item;
            for(li=1;li<=comp.numLayers;li++) { item=comp.layer(li); layers.push({id:item.id,index:item.index,name:item.name,matchName:item.matchName,inPoint:item.inPoint,outPoint:item.outPoint,selected:item.selected,locked:item.locked,enabled:item.enabled,threeDLayer:item.threeDLayer}); }
            response.result={compositionId:comp.id,name:comp.name,layerCount:layers.length,layers:layers};
        } else if(r.operation==='composition.getState') {
            if(!ctx || ctx.token!==a.context || ctx.project!==app.project || ctx.comp!==comp || comp.id!==a.compositionId) fail('STALE_CONTEXT','Active project or composition changed; query the active composition again.');
            response.result={compositionId:comp.id,name:comp.name,width:comp.width,height:comp.height,pixelAspect:comp.pixelAspect,duration:comp.duration,frameDuration:comp.frameDuration,frameRate:1/comp.frameDuration,currentTime:comp.time,workAreaStart:comp.workAreaStart,workAreaDuration:comp.workAreaDuration,displayStartTime:comp.displayStartTime,layerCount:comp.numLayers};
        } else {
            if(!ctx || ctx.token!==a.context || ctx.project!==app.project || ctx.comp!==comp || comp.id!==a.compositionId) fail('STALE_CONTEXT','Active project or composition changed; query the active composition again.');
            var layer=null,i;
            if(r.operation==='layer.createText') {
                app.beginUndoGroup('Creative OS: Create Text'); group=true;
                layer=comp.layers.addText(a.text); changed=true; createdId=layer.id;
                var actual=layer.property('ADBE Text Properties').property('ADBE Text Document').value.text;
                if(actual!==a.text) fail('READBACK_MISMATCH','Text did not match request.');
                response.result={compositionId:comp.id,layerId:layer.id,text:actual,position:position(layer).value,retained:true};
            } else {
                for(i=1;i<=comp.numLayers;i++) if(comp.layer(i).id===a.layerId) {layer=comp.layer(i);break;}
                if(!layer) fail('LAYER_NOT_FOUND','Layer ID is not in this composition.');
                var p=position(layer),before=p.value;
                if(r.operation==='layer.getTransform') {
                    var tg=layer.property('ADBE Transform Group');
                    response.result={compositionId:comp.id,layerId:layer.id,name:layer.name,anchorPoint:tg.property('ADBE Anchor Point').value,position:p.value,scale:tg.property('ADBE Scale').value,rotation:tg.property('ADBE Rotate Z').value,opacity:tg.property('ADBE Opacity').value,threeDLayer:layer.threeDLayer};
                } else if(r.operation==='layer.getSourceInfo') {
                    var src=layer.source;
                    response.result={compositionId:comp.id,layerId:layer.id,name:layer.name,matchName:layer.matchName,sourceName:src?src.name:null,sourceType:src?(src instanceof CompItem?'composition':(src.mainSource?'footage':'unknown')):null,sourceId:src?src.id:null};
                } else if(r.operation==='layer.getTextDocument') {
                    if(layer.matchName!=='ADBE Text Layer') fail('NOT_TEXT_LAYER','Layer is not an After Effects text layer.');
                    var td=layer.property('ADBE Text Properties').property('ADBE Text Document').value;
                    response.result={compositionId:comp.id,layerId:layer.id,text:td.text,font:td.font,fontSize:td.fontSize,fillColor:td.applyFill?td.fillColor:null,strokeColor:td.applyStroke?td.strokeColor:null,strokeWidth:td.applyStroke?td.strokeWidth:0,applyFill:td.applyFill,applyStroke:td.applyStroke,justification:td.justification};
                } else if(r.operation==='layer.getAnimationState') {
                    var ag=layer.property('ADBE Transform Group'), names=['anchorPoint','position','scale','rotation','opacity'], props=[ag.property('ADBE Anchor Point'),ag.property('ADBE Position'),ag.property('ADBE Scale'),ag.property('ADBE Rotate Z'),ag.property('ADBE Opacity')], anim={}, ai, aj, ap, af=[];
                    for(ai=0;ai<props.length;ai++){ap=props[ai];af=[];for(aj=1;aj<=ap.numKeys;aj++)af.push({time:ap.keyTime(aj),value:ap.keyValue(aj)});anim[names[ai]]={value:ap.value,numKeys:ap.numKeys,keyframes:af};}
                    response.result={compositionId:comp.id,layerId:layer.id,name:layer.name,animation:anim};
                } else
                if(r.operation==='layer.getPosition') response.result={compositionId:comp.id,layerId:layer.id,value:before};
                else if(r.operation==='layer.setPosition') {
                    if(layer.locked) fail('LAYER_LOCKED','Unlock the layer before editing.');
                    if(p.isTimeVarying || p.expressionEnabled || p.dimensionsSeparated) fail('UNSUPPORTED_POSITION','Animated, expression-driven, or separated Position is not supported in this milestone.');
                    if(a.value.length!==before.length) fail('DIMENSION_MISMATCH','Use the dimension count returned by getPosition.');
                    app.beginUndoGroup('Creative OS: Set Position'); group=true;
                    p.setValue(a.value); changed=true;
                    if(encode(p.value)!==encode(a.value)) fail('READBACK_MISMATCH','Position did not match request.');
                    response.result={compositionId:comp.id,layerId:layer.id,before:before,value:p.value,retained:true};
                } else if(r.operation==='layer.addTransformKeyframes') {
                    var tr=layer.property('ADBE Transform Group'), tp=a.property==='scale'?tr.property('ADBE Scale'):tr.property('ADBE Rotate Z'), tk=a.keyframes;
                    if(tp.isTimeVarying || tp.expressionEnabled || tk.length!==2 || tk[1].time<=tk[0].time) fail('INVALID_KEYFRAMES','Use two increasing Scale or Rotation keyframes.');
                    if((a.property==='scale' && (tk[0].value.length!==3 || tk[1].value.length!==3)) || (a.property==='rotation' && (tk[0].value.length!==1 || tk[1].value.length!==1))) fail('INVALID_KEYFRAMES','Scale needs 3 values; Rotation needs 1 value.');
                    app.beginUndoGroup('Creative OS: Transform Keyframes'); group=true; tp.setValueAtTime(tk[0].time,tk[0].value); tp.setValueAtTime(tk[1].time,tk[1].value); changed=true;
                    response.result={compositionId:comp.id,layerId:layer.id,property:a.property,keyframes:[{time:tk[0].time,value:tp.valueAtTime(tk[0].time,false)},{time:tk[1].time,value:tp.valueAtTime(tk[1].time,false)}],retained:true};
                } else if(r.operation==='layer.setTiming') {
                    if(layer.locked) fail('LAYER_LOCKED','Unlock the layer before editing.');
                    if(a.inPoint<0 || a.outPoint<=a.inPoint || a.outPoint>comp.duration) fail('INVALID_TIMING','Timing must be within the composition.');
                    app.beginUndoGroup('Creative OS: Layer Timing'); group=true; var oldIn=layer.inPoint,oldOut=layer.outPoint; layer.inPoint=a.inPoint; layer.outPoint=a.outPoint; changed=true; response.result={compositionId:comp.id,layerId:layer.id,before:{inPoint:oldIn,outPoint:oldOut},inPoint:layer.inPoint,outPoint:layer.outPoint,retained:true};
                } else if(r.operation==='layer.addAnchorPointKeyframes') {
                    var at=layer.property('ADBE Transform Group').property('ADBE Anchor Point'), ak=a.keyframes;
                    if(at.isTimeVarying || at.expressionEnabled || ak.length!==2 || ak[1].time<=ak[0].time || ak[0].value.length!==at.value.length || ak[1].value.length!==at.value.length) fail('INVALID_KEYFRAMES','Use two increasing Anchor Point keyframes with matching dimensions.');
                    app.beginUndoGroup('Creative OS: Anchor Point Keyframes'); group=true; at.setValueAtTime(ak[0].time,ak[0].value); at.setValueAtTime(ak[1].time,ak[1].value); changed=true; response.result={compositionId:comp.id,layerId:layer.id,property:'anchorPoint',keyframes:ak,retained:true};
                } else if(r.operation==='layer.addPositionKeyframes' || r.operation==='layer.addOpacityKeyframes') {
                    if(r.operation==='layer.addOpacityKeyframes') {
                        var op=layer.property('ADBE Transform Group').property('ADBE Opacity'), ok=a.keyframes, oi;
                        var invalidOpacity=false;
                        for(oi=0;oi<ok.length;oi++) if(ok[oi].value[0]<0 || ok[oi].value[0]>100) invalidOpacity=true;
                        if(op.isTimeVarying || op.expressionEnabled || ok.length!==2 || ok[1].time<=ok[0].time || ok[0].value.length!==1 || ok[1].value.length!==1 || invalidOpacity) fail('INVALID_KEYFRAMES','Opacity needs two increasing times and values from 0 to 100.');
                        app.beginUndoGroup('Creative OS: Opacity Keyframes'); group=true;
                        for(oi=0;oi<ok.length;oi++) op.setValueAtTime(ok[oi].time,ok[oi].value[0]);
                        changed=true; response.result={compositionId:comp.id,layerId:layer.id,property:'opacity',keyframes:[{time:ok[0].time,value:op.valueAtTime(ok[0].time,false)},{time:ok[1].time,value:op.valueAtTime(ok[1].time,false)}],retained:true};
                    } else {
                    if(p.isTimeVarying || p.expressionEnabled || p.dimensionsSeparated) fail('UNSUPPORTED_POSITION','Animated, expression-driven, or separated Position is not supported.');
                    var k=a.keyframes, j;
                    if(k[0].value.length!==p.value.length || k[1].value.length!==p.value.length || k[1].time<=k[0].time) fail('INVALID_KEYFRAMES','Use two increasing times and matching Position dimensions.');
                    app.beginUndoGroup('Creative OS: Position Keyframes'); group=true;
                    for(j=0;j<k.length;j++) p.setValueAtTime(k[j].time,k[j].value);
                    changed=true; response.result={compositionId:comp.id,layerId:layer.id,property:'position',keyframes:[{time:k[0].time,value:p.valueAtTime(k[0].time,false)},{time:k[1].time,value:p.valueAtTime(k[1].time,false)}],retained:true}; }
                } else if(r.operation==='layer.getKeyframes') {
                    var prop=a.property==='position'?p:layer.property('ADBE Transform Group').property('ADBE Opacity'), frames=[], q;
                    for(q=1;q<=prop.numKeys;q++) frames.push({time:prop.keyTime(q),value:prop.keyValue(q)});
                    response.result={compositionId:comp.id,layerId:layer.id,property:a.property,keyframes:frames};
                } else fail('INVALID_OPERATION','Unknown operation');
            }
        }
        response.success=true;
    } catch(e) {
        response.error={code:e.code || 'AE_ERROR',message:String(e.message || e),changed:changed,createdLayerId:createdId,retained:changed};
    } finally {
        if(group) app.endUndoGroup();
    }
    // No automatic undo, removal, reset, save, or project close, even on failure.
    try { write(cfg.responsePath,response); }
    catch(e) { alert('Creative OS could not write its response. Any changes remain for inspection.\n'+String(e)); }
}());

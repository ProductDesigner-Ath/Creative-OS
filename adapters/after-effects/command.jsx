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
                if(r.operation==='layer.getPosition') response.result={compositionId:comp.id,layerId:layer.id,value:before};
                else if(r.operation==='layer.setPosition') {
                    if(layer.locked) fail('LAYER_LOCKED','Unlock the layer before editing.');
                    if(p.isTimeVarying || p.expressionEnabled || p.dimensionsSeparated) fail('UNSUPPORTED_POSITION','Animated, expression-driven, or separated Position is not supported in this milestone.');
                    if(a.value.length!==before.length) fail('DIMENSION_MISMATCH','Use the dimension count returned by getPosition.');
                    app.beginUndoGroup('Creative OS: Set Position'); group=true;
                    p.setValue(a.value); changed=true;
                    if(encode(p.value)!==encode(a.value)) fail('READBACK_MISMATCH','Position did not match request.');
                    response.result={compositionId:comp.id,layerId:layer.id,before:before,value:p.value,retained:true};
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

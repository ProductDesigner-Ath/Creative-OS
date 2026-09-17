/* Creative OS G0. Fixed local test, ExtendScript ES3; no network or remote input. */
(function () {
    var cfg = __G0_CONFIG__;
    var log = new File(cfg.logPath);
    log.encoding = 'UTF-8';
    function encode(v) {
        if (v === null || v === undefined) return 'null';
        if (typeof v === 'string') return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\x00-\x1f]/g, function (c) { return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4); }) + '"';
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        var a = [], k;
        if (v instanceof Array) { for (k = 0; k < v.length; k++) a.push(encode(v[k])); return '[' + a.join(',') + ']'; }
        for (k in v) if (v.hasOwnProperty(k)) a.push(encode(k) + ':' + encode(v[k]));
        return '{' + a.join(',') + '}';
    }
    function record(event, data) {
        if (!log.open('a')) throw new Error('Cannot open local log: ' + log.error);
        var ok = log.writeln(encode({runId:cfg.runId, timeMs:(new Date()).getTime(), event:event, data:data}));
        log.close();
        if (!ok) throw new Error('Cannot write local log');
    }
    function check(ok, message) { if (!ok) throw new Error(message); }
    function ids(comp) { var out = [], i; for (i = 1; i <= comp.numLayers; i++) out.push(comp.layer(i).id); return out; }
    function same(a, b) { return encode(a) === encode(b); }
    var comp, layer, before, layerId, groupOpen = false, changed = false, undoAttempted = false;
    try {
        // Probe write access before any project mutation. Never change preferences.
        if (!log.open('w')) throw new Error('Enable Allow Scripts to Write Files and Access Network in AE Preferences > Scripting & Expressions, then rerun. ' + log.error);
        log.close();
        record('start', {version:app.version, build:app.buildNumber, language:app.isoLanguage, undoCommandId:16});
        comp = app.project && app.project.activeItem;
        check(comp instanceof CompItem, 'NO_ACTIVE_COMP: open a composition before running G0.');
        before = ids(comp);
        record('get_active_comp', {id:comp.id, name:comp.name, width:comp.width, height:comp.height, layerIds:before});

        app.beginUndoGroup('Creative OS G0'); groupOpen = true;
        layer = comp.layers.addText('Creative OS'); changed = true; layerId = layer.id;
        check(layer.property('ADBE Text Properties').property('ADBE Text Document').value.text === 'Creative OS', 'Text readback mismatch');
        check(comp.numLayers === before.length + 1, 'Layer count did not increase by one');
        record('create_text_layer', {id:layerId, text:'Creative OS'});

        var position = layer.property('ADBE Transform Group').property('ADBE Position');
        var initial = position.value;
        check((initial.length === 2 || initial.length === 3) && !position.isTimeVarying && !position.dimensionsSeparated, 'Unexpected position configuration: ' + encode({value:initial, timeVarying:position.isTimeVarying, separated:position.dimensionsSeparated}));
        record('read_position', {layerId:layerId, value:initial, threeDLayer:layer.threeDLayer});

        var target = initial.slice(0);
        target[0] += 120; target[1] += 60;
        position.setValue(target);
        check(same(position.value, target), 'Position readback mismatch');
        record('set_position', {layerId:layerId, before:initial, requested:target, actual:position.value});
        app.endUndoGroup(); groupOpen = false;

        // AE Edit > Undo. One synchronous run prevents user edits between mutation and undo.
        // Command 16 is host-specific: the postcondition, not the command return, proves undo.
        undoAttempted = true;
        app.executeCommand(16);
        check(same(ids(comp), before), 'UNDO_MISMATCH: original ordered layer IDs were not restored. Do not retry blindly.');
        record('undo', {removedLayerId:layerId, beforeLayerIds:before, afterLayerIds:ids(comp), restored:true});
        record('complete', {pass:true, operations:5});
    } catch (e) {
        var cleanup = 'not_needed';
        if (groupOpen) { app.endUndoGroup(); groupOpen = false; }
        if (changed && !undoAttempted) {
            try { app.executeCommand(16); cleanup = same(ids(comp), before) ? 'undo_verified' : 'undo_mismatch'; }
            catch (ce) { cleanup = 'undo_failed: ' + String(ce); }
        } else if (undoAttempted) cleanup = 'undo_already_attempted_no_second_undo';
        try { record('error', {message:String(e), line:e.line || null, changed:changed, cleanup:cleanup}); record('complete', {pass:false}); }
        catch (loggingError) { alert('Creative OS G0 stopped before reliable logging.\n' + String(e) + '\n' + String(loggingError)); }
    }
}());

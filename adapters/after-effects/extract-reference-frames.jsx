/* Creative OS local reference-frame extractor. No network access. */
(function () {
    function fail(message) { throw new Error(message); }
    function writeText(file, text) { if(!file.open('w')) fail('Cannot write '+file.fsName); file.writeln(text); file.close(); }
    function isVideo(entry) { return entry instanceof File && /\.(mp4|mov|avi|mkv|webm)$/i.test(entry.name); }
    try {
        var root=(new File($.fileName)).parent.parent.parent.fsName.replace(/\\/g,'/');
        var referenceFolder=new Folder(root+'/assets/reference');
        var files=referenceFolder.getFiles(isVideo);
        var preferred=[], i;
        for(i=0;i<files.length;i++) { if(/h\.?(264|265)|prores/i.test(files[i].name)) preferred.push(files[i]); }
        if(preferred.length===1) files=preferred;
        if(!files || files.length!==1) fail('Place one compatible reference video in assets/reference, or name the compatible copy with H264, H265, or ProRes.');
        var source=files[0], imported=app.project.importFile(new ImportOptions(source));
        if(!(imported instanceof FootageItem)) fail('Reference video could not be imported. Convert it to H.264 or ProRes, then run this extractor again.');
        var frameRate=imported.frameRate>0?imported.frameRate:24;
        var duration=imported.duration>0?imported.duration:5;
        var comp=app.project.items.addComp('Creative OS Reference Analysis',imported.width,imported.height,1,duration,frameRate);
        comp.layers.add(imported); comp.openInViewer();
        var outputFolder=new Folder(root+'/.local/reference-frames'); if(!outputFolder.exists && !outputFolder.create()) fail('Cannot create local frame output folder.');
        var manifest=new File(outputFolder.fsName+'/manifest.txt'), samples=7, t, frame, output;
        writeText(manifest,'source='+source.fsName+'\nduration='+duration+'\nframeRate='+frameRate+'\n');
        for(i=0;i<samples;i++) { t=(duration/(samples-1))*i; frame=Math.round(t*frameRate); output=new File(outputFolder.fsName+'/frame-'+('000'+frame).slice(-3)+'.png'); comp.saveFrameToPng(t,output); }
        alert('Creative OS extracted '+samples+' local reference frames to:\n'+outputFolder.fsName+'\n\nThe video and frames are not added to GitHub.');
    } catch(e) { alert('Creative OS reference extraction failed:\n'+String(e)); }
}());

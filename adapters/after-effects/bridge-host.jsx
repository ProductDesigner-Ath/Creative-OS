/* Creative OS trusted local host. Run once per AE session. */
$.global.__creativeOSHost=true;
$.global.__creativeOSHostPoll=function () {
    var root='C:/Users/athar/.codex/.chatgpt-projects/g-p-6aac07cb0554819185840c6cbf9905f4/creative-os/.local';
    var status=new File(root+'/ae-host-status.json'), errors=new File(root+'/ae-host-error.txt'), pending=new File(root+'/pending-command.json');
    try {
        if(status.open('w')) { status.writeln('{"running":true,"version":"0.1"}'); status.close(); }
        if(!pending.exists || !pending.open('r')) return;
        var raw=pending.read(), match; pending.close();
        match=raw.match(/^\{"commandPath":"(C:\/Users\/athar\/\.codex\/\.chatgpt-projects\/g-p-6aac07cb0554819185840c6cbf9905f4\/creative-os\/\.local\/requests\/[a-f0-9-]+\/command\.jsx)","requestId":"[a-f0-9-]+"\}$/);
        if(!match) return;
        var command=new File(match[1]);
        if(command.exists) $.evalFile(match[1]);
        pending.remove();
    } catch(e) { if(errors.open('w')) { errors.writeln(String(e)); errors.close(); } }
};
app.scheduleTask('$.global.__creativeOSHost && $.global.__creativeOSHostPoll()',500,true);
$.global.__creativeOSHostPoll();

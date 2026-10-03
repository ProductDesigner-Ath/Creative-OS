/* Creative OS trusted local host. Auto-started once per AE session. */
$.global.__creativeOSHost=true;
$.global.__creativeOSHostPoll=function () {
    var root='D:/Creative-OS/.local';
    var status=new File(root+'/ae-host-status.json'), errors=new File(root+'/ae-host-error.txt'), pending=new File(root+'/pending-command.json');
    try {
        if(status.open('w')) { status.writeln('{"running":true,"version":"0.1"}'); status.close(); }
        if(pending.exists && pending.open('r')) {
            var raw=pending.read(), match; pending.close();
            match=raw.match(/^\{"commandPath":"([^"]+)","requestId":"([a-f0-9-]+)"\}$/);
            if(match && match[1].indexOf(root+'/requests/')===0 && match[1].slice(-12)==='/command.jsx' && match[2].match(/^[a-f0-9-]{36}$/)) {
                var command=new File(match[1]);
                if(command.exists) $.evalFile(command);
                pending.remove();
            }
        }
    } catch(e) { if(errors.open('w')) { errors.writeln(String(e)); errors.close(); } }
    app.scheduleTask("$.evalFile('D:/Creative-OS/adapters/after-effects/bridge-host.jsx')",500,false);
};
$.global.__creativeOSHostPoll();

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, open, unlink, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { validate } from './validate.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const exe = process.env.AE_EXE || 'C:\\Program Files\\Adobe\\Adobe After Effects 2026\\Support Files\\AfterFX.exe';
const prepareOnly = process.argv.includes('--prepare');
if (!process.argv.includes('--verify-undo')) throw new Error('G0 automatically undoes its changes. User preference is to retain AE work. Only run with --verify-undo after an explicit request to test undo.');
if (process.argv.slice(2).some(x => !['--prepare','--verify-undo'].includes(x))) throw new Error('Usage: node ae-spike/run.mjs --verify-undo [--prepare]');
await access(exe);
await mkdir(path.join(root, 'runs'), {recursive:true});
const lockPath = path.join(root, 'runs', 'active.lock');
let lock;
try { lock = await open(lockPath, 'wx'); }
catch { throw new Error('A G0 run is active or unresolved. Inspect runs/active.lock and AE before removing the lock manually.'); }
let resolved = false;
try {
  const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8);
  const dir = path.join(root, 'runs', runId);
  await mkdir(dir);
  const logPath = path.join(dir, 'events.jsonl');
  const scriptPath = path.join(dir, 'g0.jsx');
  const source = await readFile(path.join(root, 'g0.jsx'), 'utf8');
  const config = JSON.stringify({runId,logPath:logPath.replaceAll('\\', '/')}).replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
  await writeFile(scriptPath, source.replace('__G0_CONFIG__', () => config));
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({runId,exe,node:process.version,platform:process.platform,sourceSha256:createHash('sha256').update(source).digest('hex'),preparedOnly:prepareOnly},null,2));
  await lock.writeFile(JSON.stringify({runId,scriptPath,logPath,pid:process.pid},null,2));
  console.log('G0 run:', runId, '\nEvidence:', dir);
  if (prepareOnly) {
    console.log('Prepared only. Run this file through AE > File > Scripts > Run Script File:\n' + scriptPath);
    console.log('The lock stays in place until the manual result is inspected.');
  } else {
    // Fixed repository-owned script only; no shell, server, or arbitrary script parameter.
    const child = spawn(exe, ['-r', scriptPath], {shell:false,windowsHide:true,stdio:'ignore'});
    let launchError;
    child.on('error', e => { launchError = e; });
    child.unref();
    const deadline = Date.now() + 45000;
    let events = [];
    while (Date.now() < deadline) {
      if (launchError) { resolved = true; throw launchError; }
      let raw = '';
      try { raw = await readFile(logPath, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      // Only parse terminated lines: AE may still be writing the last line.
      events = raw.replace(/^\uFEFF/,'').split(/\r?\n/).slice(0,-1).filter(Boolean).map(x => JSON.parse(x));
      if (events.some(x => x.event === 'complete')) break;
      await new Promise(r => setTimeout(r,250));
    }
    if (!events.some(x => x.event === 'complete')) {
      throw new Error('TIMEOUT: outcome unknown; do not rerun. Inspect AE for a dialog and the log. The lock is retained because AE may execute a queued script later.');
    }
    const result = validate(events, runId);
    await writeFile(path.join(dir,'result.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
    resolved = result.pass || events.some(x => x.event === 'error' && (x.data.changed === false || x.data.cleanup === 'undo_verified'));
    if (!result.pass) process.exitCode = 1;
  }
} finally {
  await lock.close();
  if (resolved) await unlink(lockPath);
}

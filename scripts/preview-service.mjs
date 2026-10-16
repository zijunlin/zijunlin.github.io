import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, rename, realpath } from 'node:fs/promises';
import { join } from 'node:path';

async function saveRecord(file, record) {
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
  await rename(temp, file);
}

// Stop via the owning process and its child handle, never a potentially reused PID.
export async function trackService(child, { root, directory, log, port, session }) {
  root = await realpath(root);
  const token = randomUUID(), file = join(directory, 'service.json');
  const record = { root, session, pid: process.pid, childPid: child.pid, startedAt: new Date().toISOString(),
    url: `http://127.0.0.1:${port}/`, log, token, state: 'running' };
  const server = createServer((request, response) => {
    const supplied = Buffer.from(request.headers.authorization || ''), expected = Buffer.from(`Bearer ${token}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { response.writeHead(403).end(); return; }
    if (request.url !== '/' || !['GET', 'POST'].includes(request.method)) { response.writeHead(404).end(); return; }
    if (request.method === 'POST') { record.state = 'stopping'; child.kill('SIGTERM'); }
    const { token: _token, ...publicRecord } = record;
    response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(publicRecord));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  record.controlPort = server.address().port;
  try { await saveRecord(file, record); }
  catch (error) { server.close(); throw error; }
  return async () => {
    await new Promise(resolve => server.close(resolve));
    record.state = 'stopped'; record.stoppedAt = new Date().toISOString();
    await saveRecord(file, record);
  };
}

export async function serviceStatus(root, directory, { stop = false } = {}) {
  root = await realpath(root);
  let record;
  try { record = JSON.parse(await readFile(join(directory, 'service.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { state: 'not-recorded' }; throw error; }
  if (record.root !== root) throw new Error('Service record belongs to another checkout');
  const { token, ...publicRecord } = record;
  if (record.state === 'stopped') return publicRecord;
  if (!Number.isInteger(record.controlPort) || record.controlPort < 1 || record.controlPort > 65535) throw new Error('Invalid service control port');
  const url = `http://127.0.0.1:${record.controlPort}/`;
  try {
    const options = { headers: { authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(2000) };
    const response = await fetch(url, options);
    if (!response.ok) throw new Error('Service identity could not be authenticated');
    const live = await response.json();
    if (live.root !== root || live.session !== record.session || live.startedAt !== record.startedAt) throw new Error('Service identity changed');
    if (stop) {
      const stopped = await fetch(url, { ...options, method: 'POST', signal: AbortSignal.timeout(2000) });
      if (!stopped.ok) throw new Error('Service stop rejected');
      return await stopped.json();
    }
    return live;
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') return { ...publicRecord, state: 'stale', note: 'Owner is gone; no process was signalled' };
    throw error;
  }
}

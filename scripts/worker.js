import { setTimeout } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';

const base = process.env.API_URL ?? 'http://127.0.0.1:4310';
const token = process.env.API_TOKEN;
const queueId = process.env.QUEUE_ID;
if (!token || !queueId) throw new Error('API_TOKEN and QUEUE_ID are required');
const workerId = process.env.WORKER_ID ?? randomUUID();
let stopped = false;
process.on('SIGINT', () => { stopped = true; });
process.on('SIGTERM', () => { stopped = true; });

async function post(path, body) {
  const response = await fetch(base + path, {
    method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? 'API request failed');
  return data;
}

while (!stopped) {
  try {
    const { job } = await post('/api/jobs/claim', { queueId, workerId });
    if (!job) { await setTimeout(1000); continue; }
    try {
      let result;
      if (job.type === 'echo') result = job.payload;
      else if (job.type === 'sum') {
        if (!Array.isArray(job.payload) || !job.payload.every(Number.isFinite)) throw new Error('sum requires an array of finite numbers');
        result = job.payload.reduce((sum, value) => sum + value, 0);
        if (!Number.isFinite(result)) throw new Error('sum overflowed');
      } else throw new Error('Requested failure handler');
      await post('/api/jobs/' + job.id + '/complete', { token: job.leaseToken, result: JSON.stringify(result) });
    } catch (error) {
      await post('/api/jobs/' + job.id + '/fail', { token: job.leaseToken, error: error.message.slice(0, 2000) });
    }
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: error.message }));
    await setTimeout(2000);
  }
}

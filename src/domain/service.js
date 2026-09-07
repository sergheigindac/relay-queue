import { Queues } from './queues.js';
import { Jobs } from './jobs.js';
import { Schedules } from './schedules.js';
import * as s from './schemas.js';

export function createDomain(store) {
  const queues = new Queues(store);
  const jobs = new Jobs(store);
  const schedules = new Schedules(store, jobs);
  const routes = [
    ['GET', '/api/queues', 'listQueues', 'List queues', null, () => store.all('queue')],
    ['POST', '/api/queues', 'createQueue', 'Create a queue', s.queueInput, c => queues.create(c.body)],
    ['GET', '/api/queues/:id', 'getQueue', 'Read a queue', null, c => store.get('queue', c.params.id)],
    ['PATCH', '/api/queues/:id', 'controlQueue', 'Pause or resume claims', s.queueControl, c => queues.control(c.params.id, c.body)],
    ['GET', '/api/queues/:id/stats', 'queueStats', 'Inspect queue utilization', null, c => queues.stats(c.params.id)],
    ['GET', '/api/jobs', 'listJobs', 'List and filter jobs', null, c => store.all('job').filter(j => (!c.query.status || j.status === c.query.status) && (!c.query.queueId || j.queueId === c.query.queueId))],
    ['POST', '/api/jobs', 'enqueueJob', 'Enqueue a job', s.jobInput, c => jobs.enqueue(c.body)],
    ['POST', '/api/jobs/batch', 'enqueueBatch', 'Enqueue an atomic batch', s.batchInput, c => jobs.batch(c.body)],
    ['POST', '/api/jobs/claim', 'claimJob', 'Claim the next available job', s.claimInput, c => jobs.claim(c.body)],
    ['GET', '/api/jobs/:id', 'getJob', 'Read job state', null, c => store.get('job', c.params.id)],
    ['POST', '/api/jobs/:id/heartbeat', 'renewLease', 'Extend a worker lease', s.leaseInput, c => jobs.heartbeat(c.params.id, c.body)],
    ['POST', '/api/jobs/:id/complete', 'completeJob', 'Complete a leased job', s.completeInput, c => jobs.complete(c.params.id, c.body)],
    ['POST', '/api/jobs/:id/fail', 'failJob', 'Record an attempt failure', s.failInput, c => jobs.fail(c.params.id, c.body)],
    ['POST', '/api/jobs/:id/cancel', 'cancelJob', 'Cancel unfinished work', s.cancelInput, c => jobs.cancel(c.params.id, c.body)],
    ['POST', '/api/jobs/:id/retry', 'retryJob', 'Replay a dead or cancelled job', s.object ?? { type: 'object', properties: {}, required: [], additionalProperties: false }, c => jobs.retry(c.params.id)],
    ['GET', '/api/schedules', 'listSchedules', 'List recurring schedules', null, () => store.all('schedule')],
    ['POST', '/api/schedules', 'createSchedule', 'Create a recurring schedule', s.scheduleInput, c => schedules.create(c.body)],
    ['PATCH', '/api/schedules/:id', 'controlSchedule', 'Enable or disable a schedule', s.scheduleControl, c => schedules.control(c.params.id, c.body)],
    ['POST', '/api/tick', 'runScheduler', 'Reclaim leases and dispatch due schedules', { type: 'object', properties: {}, required: [], additionalProperties: false }, () => schedules.tick()],
  ];
  return { routes, queues, jobs, schedules, tick: () => schedules.tick() };
}

import { Transport } from './transport.js';

/** Named operations for the application API. Generated from route definitions. */
export class Client extends Transport {

  /** List queues. */
  listQueues(options = {}) {
    return this.request('GET', "/api/queues", { ...options });
  }

  /** Create a queue. */
  createQueue(body, options = {}) {
    return this.request('POST', "/api/queues", { ...options, body });
  }

  /** Read a queue. */
  getQueue(id, options = {}) {
    return this.request('GET', '/api/queues/' + encodeURIComponent(id) + '', { ...options });
  }

  /** Pause or resume claims. */
  controlQueue(id, body, options = {}) {
    return this.request('PATCH', '/api/queues/' + encodeURIComponent(id) + '', { ...options, body });
  }

  /** Inspect queue utilization. */
  queueStats(id, options = {}) {
    return this.request('GET', '/api/queues/' + encodeURIComponent(id) + '/stats', { ...options });
  }

  /** List and filter jobs. */
  listJobs(options = {}) {
    return this.request('GET', "/api/jobs", { ...options });
  }

  /** Enqueue a job. */
  enqueueJob(body, options = {}) {
    return this.request('POST', "/api/jobs", { ...options, body });
  }

  /** Enqueue an atomic batch. */
  enqueueBatch(body, options = {}) {
    return this.request('POST', "/api/jobs/batch", { ...options, body });
  }

  /** Claim the next available job. */
  claimJob(body, options = {}) {
    return this.request('POST', "/api/jobs/claim", { ...options, body });
  }

  /** Read job state. */
  getJob(id, options = {}) {
    return this.request('GET', '/api/jobs/' + encodeURIComponent(id) + '', { ...options });
  }

  /** Extend a worker lease. */
  renewLease(id, body, options = {}) {
    return this.request('POST', '/api/jobs/' + encodeURIComponent(id) + '/heartbeat', { ...options, body });
  }

  /** Complete a leased job. */
  completeJob(id, body, options = {}) {
    return this.request('POST', '/api/jobs/' + encodeURIComponent(id) + '/complete', { ...options, body });
  }

  /** Record an attempt failure. */
  failJob(id, body, options = {}) {
    return this.request('POST', '/api/jobs/' + encodeURIComponent(id) + '/fail', { ...options, body });
  }

  /** Cancel unfinished work. */
  cancelJob(id, body, options = {}) {
    return this.request('POST', '/api/jobs/' + encodeURIComponent(id) + '/cancel', { ...options, body });
  }

  /** Replay a dead or cancelled job. */
  retryJob(id, body, options = {}) {
    return this.request('POST', '/api/jobs/' + encodeURIComponent(id) + '/retry', { ...options, body });
  }

  /** List recurring schedules. */
  listSchedules(options = {}) {
    return this.request('GET', "/api/schedules", { ...options });
  }

  /** Create a recurring schedule. */
  createSchedule(body, options = {}) {
    return this.request('POST', "/api/schedules", { ...options, body });
  }

  /** Enable or disable a schedule. */
  controlSchedule(id, body, options = {}) {
    return this.request('PATCH', '/api/schedules/' + encodeURIComponent(id) + '', { ...options, body });
  }

  /** Reclaim leases and dispatch due schedules. */
  runScheduler(body, options = {}) {
    return this.request('POST', "/api/tick", { ...options, body });
  }
}

import { ensure } from '../core/errors.js';
import { parsePayload } from './jobs.js';

export class Schedules {
  constructor(store, jobs) { this.store = store; this.jobs = jobs; }

  create(input) {
    return this.store.transaction(() => {
      this.store.get('queue', input.queueId);
      parsePayload(input.payload);
      ensure(!this.store.find('schedule', s => s.name === input.name), 409, 'duplicate_name', 'Schedule name already exists');
      const schedule = this.store.create('schedule', {
        ...input, enabled: true, nextRunAt: this.store.clock() + input.intervalMs, runs: 0,
      });
      this.store.event('schedule.created', schedule.id);
      return schedule;
    });
  }

  control(id, { enabled, revision }) {
    return this.store.transaction(() => {
      const schedule = this.store.update('schedule', id, { enabled }, revision);
      this.store.event(enabled ? 'schedule.enabled' : 'schedule.disabled', id);
      return schedule;
    });
  }

  tick() {
    return this.store.transaction(() => {
      for (const queue of this.store.all('queue')) this.jobs.reclaim(queue);
      let dispatched = 0;
      for (const schedule of this.store.all('schedule')) {
        if (!schedule.enabled || schedule.nextRunAt > this.store.clock()) continue;
        this.jobs.enqueue({
          queueId: schedule.queueId, type: schedule.type, payload: schedule.payload,
          priority: 0, delayMs: 0, dedupeKey: 'schedule:' + schedule.id + ':' + schedule.nextRunAt,
        });
        this.store.update('schedule', schedule.id, { nextRunAt: this.store.clock() + schedule.intervalMs, runs: schedule.runs + 1 });
        this.store.event('schedule.dispatched', schedule.id);
        dispatched++;
      }
      return { dispatched };
    });
  }
}

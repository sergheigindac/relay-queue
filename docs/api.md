# API reference

Local base URL: http://127.0.0.1:4310. Domain endpoints require Authorization: Bearer <API_TOKEN>. Mutations use Content-Type: application/json. Successful domain operations return 200. Timestamps are UTC Unix milliseconds.

Examples use placeholder resource identifiers. Replace them with IDs from earlier creation calls. Maintenance timestamps are illustrative and must end in the future.

## Common behavior

- Unknown fields and invalid types return 422 with the failing field path.
- Lists return items, total, limit, and offset. Maximum limit is 200.
- Revisions begin at 1 and increment after updates.
- Mutations optionally accept Idempotency-Key for 24-hour replay.
- State conflicts return 409; missing records return 404.
- /health is public; /ready, /metrics, /openapi.json, and /api/events require authentication.
- /api/events accepts after, limit, and resourceId and returns items plus a next sequence cursor.

## Operations

### listWorkers

Inspect workers with historical job ownership.

~~~http
GET /api/workers
Authorization: Bearer <API_TOKEN>
~~~

Pagination: append ?limit=50&offset=0. Increase offset by the number of returned items until it reaches total. Concurrent writes can change offset-based results.

Client method: client.listWorkers(options?).

### throughputReport

Summarize completed job throughput and latency.

~~~http
GET /api/reports/throughput
Authorization: Bearer <API_TOKEN>
~~~

Client method: client.throughputReport(options?).

### jobDependencies

Inspect dependency readiness and failures.

~~~http
GET /api/jobs/{id}/dependencies
Authorization: Bearer <API_TOKEN>
~~~

Path parameter id: resource identifier returned by a creation operation.

Client method: client.jobDependencies(id, options?).

### jobHistory

Read the job attempt timeline.

~~~http
GET /api/jobs/{id}/history
Authorization: Bearer <API_TOKEN>
~~~

Path parameter id: resource identifier returned by a creation operation.

Client method: client.jobHistory(id, options?).

### drainQueue

Cancel pending work while preserving running jobs.

~~~http
POST /api/queues/{id}/drain
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-logical-request-key>
~~~

Path parameter id: resource identifier returned by a creation operation.

| Field | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| reason | string | Yes | Cancellation reason. Max length 1000 |

Example body:

~~~json
{
  "reason": "Example reason"
}
~~~

Client method: client.drainQueue(id, body, options?).

### retryDeadJobs

Retry all dead letters in a queue.

~~~http
POST /api/queues/{id}/retry-dead
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-logical-request-key>
~~~

Path parameter id: resource identifier returned by a creation operation.

| Field | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| None | object | Yes | Send an empty JSON object |

Example body:

~~~json
{}
~~~

Client method: client.retryDeadJobs(id, body, options?).

### listQueues

List queues.

~~~http
GET /api/queues
Authorization: Bearer <API_TOKEN>
~~~

Pagination: append ?limit=50&offset=0. Increase offset by the number of returned items until it reaches total. Concurrent writes can change offset-based results.

Client method: client.listQueues(options?).

### createQueue

Create a queue.

~~~http
POST /api/queues
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-logical-request-key>
~~~

| Field | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| name | string | Yes | Unique queue name. Max length 80 |
| concurrency | integer | No | Maximum active leases. Minimum 1. Maximum 1000. Default 5 |
| maxAttempts | integer | No | Default attempt limit. Minimum 1. Maximum 20. Default 3 |
| leaseMs | integer | No | Lease duration in milliseconds. Minimum 100. Maximum 3600000. Default 30000 |
| retryBaseMs | integer | No | Base exponential retry delay. Minimum 100. Maximum 60000. Default 1000 |

Example body:

~~~json
{
  "name": "example-queue",
  "concurrency": 5,
  "maxAttempts": 3,
  "leaseMs": 30000,
  "retryBaseMs": 1000
}
~~~

Client method: client.createQueue(body, options?).

### getQueue

Read a queue.

~~~http
GET /api/queues/{id}
Authorization: Bearer <API_TOKEN>
~~~

Path parameter id: resource identifier returned by a creation operation.

Client method: client.getQueue(id, options?).

### controlQueue

Pause or resume claims.

~~~http
PATCH /api/queues/{id}
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-logical-request-key>
~~~

Path parameter id: resource identifier returned by a creation operation.

| Field | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| paused | boolean | Yes | Whether new claims are paused |
| revision | integer | Yes | Expected record revision. Minimum 1. Maximum 1000000000 |

Example body:

~~~json
{
  "paused": true,
  "revision": 1
}
~~~

Client method: client.controlQueue(id, body, options?).

### queueStats

Inspect queue utilization.

~~~http
GET /api/queues/{id}/stats
Authorization: Bearer <API_TOKEN>
~~~

Path parameter id: resource identifier returned by a creation operation.

Client method: client.queueStats(id, options?).

### listJobs

List and filter jobs.

~~~http
GET /api/jobs
Authorization: Bearer <API_TOKEN>
~~~

Pagination: append ?limit=50&offset=0. Increase offset by the number of returned items until it reaches total. Concurrent writes can change offset-based results.

Client method: client.listJobs(options?).

### enqueueJob

Enqueue a job.

~~~http
POST /api/jobs
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-logical-request-key>
~~~

| Field | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| queueId | string | Yes | Resource identifier. Max length 80 |
| type | string | Yes | Built-in handler. Allowed: echo, sum, fail. Max length 200 |
| payload | string | No | JSON payload encoded as a string. Max length 16000. Default "{}" |
| priority | integer | No | Larger priority runs first. Minimum -100. Maximum 100. Default 0 |
| delayMs | integer | No | Delay before first claim. Minimum 0. Maximum 604800000. Default 0 |
| maxAttempts | integer | No | Override queue attempt limit. Minimum 1. Maximum 20 |
| dedupeKey | string | No | Permanent per-queue deduplication key. Max length 120 |
| dependsOn | array | No | Max items 50. Default [] |

Example body:

~~~json
{
  "queueId": "replace-with-resource-queueid",
  "type": "echo",
  "payload": "{}",
  "priority": 0,
  "delayMs": 0,
  "dependsOn": []
}
~~~

Client method: client.enqueueJob(body, options?).

### enqueueBatch

Enqueue an atomic batch.

~~~http
POST /api/jobs/batch
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-logical-request-key>
~~~

| Field | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| jobs | array | Yes | Max items 50 |

Example body:

~~~json
{
  "jobs": [
    {
      "queueId": "replace-with-resource-queueid",
      "type": "echo",
      "payload": "{}",
      "priority": 0,
      "delayMs": 0,
      "dependsOn": []
    }
  ]
}
~~~

Client method: client.enqueueBatch(body, options?).

### claimJob

Claim the next available job.

~~~http
POST /api/jobs/claim
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-logical-request-key>
~~~

| Field | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| queueId | string | Yes | Resource identifier. Max length 80 |
| workerId | string | Yes | Worker instance name. Max length 100 |

Example body:

~~~json
{
  "queueId": "replace-with-resource-queueid",
  "workerId": "replace-with-resource-workerid"
}
~~~

Client method: client.claimJob(body, options?).

### getJob

Read job state.

~~~http
GET /api/jobs/{id}
Authorization: Bearer <API_TOKEN>
~~~

Path parameter id: resource identifier returned by a creation operation.

Client method: client.getJob(id, options?).

### renewLease

Extend a worker lease.

~~~http
POST /api/jobs/{id}/heartbeat
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-logical-request-key>
~~~

Path parameter id: resource identifier returned by a creation operation.

| Field | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| token | string | Yes | Fencing token from claim. Max length 100 |

Example body:

~~~json
{
  "token": "replace-with-resource-token"
}
~~~

Client method: client.renewLease(id, body, options?).

### completeJob

Complete a leased job.

~~~http
POST /api/jobs/{id}/complete
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-logical-request-key>
~~~

Path parameter id: resource identifier returned by a creation operation.

| Field | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| token | string | Yes | Fencing token from claim. Max length 100 |
| result | string | No | JSON result. Max length 16000. Default "null" |

Example body:

~~~json
{
  "token": "replace-with-resource-token",
  "result": "null"
}
~~~

Client method: client.completeJob(id, body, options?).

### failJob

Record an attempt failure.

~~~http
POST /api/jobs/{id}/fail
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-logical-request-key>
~~~

Path parameter id: resource identifier returned by a creation operation.

| Field | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| token | string | Yes | Fencing token from claim. Max length 100 |
| error | string | Yes | Failure reason. Max length 2000 |

Example body:

~~~json
{
  "token": "replace-with-resource-token",
  "error": "Example error"
}
~~~

Client method: client.failJob(id, body, options?).

### cancelJob

Cancel unfinished work.

~~~http
POST /api/jobs/{id}/cancel
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-logical-request-key>
~~~

Path parameter id: resource identifier returned by a creation operation.

| Field | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| reason | string | Yes | Cancellation reason. Max length 1000 |

Example body:

~~~json
{
  "reason": "Example reason"
}
~~~

Client method: client.cancelJob(id, body, options?).

### retryJob

Replay a dead or cancelled job.

~~~http
POST /api/jobs/{id}/retry
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-logical-request-key>
~~~

Path parameter id: resource identifier returned by a creation operation.

| Field | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| None | object | Yes | Send an empty JSON object |

Example body:

~~~json
{}
~~~

Client method: client.retryJob(id, body, options?).

### listSchedules

List recurring schedules.

~~~http
GET /api/schedules
Authorization: Bearer <API_TOKEN>
~~~

Pagination: append ?limit=50&offset=0. Increase offset by the number of returned items until it reaches total. Concurrent writes can change offset-based results.

Client method: client.listSchedules(options?).

### createSchedule

Create a recurring schedule.

~~~http
POST /api/schedules
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-logical-request-key>
~~~

| Field | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| name | string | Yes | Schedule name. Max length 200 |
| queueId | string | Yes | Resource identifier. Max length 80 |
| type | string | Yes | Built-in handler. Allowed: echo, sum, fail. Max length 200 |
| payload | string | No | JSON payload encoded as a string. Max length 16000. Default "{}" |
| intervalMs | integer | Yes | Fixed delay between scheduled jobs. Minimum 1000. Maximum 604800000 |

Example body:

~~~json
{
  "name": "Example name",
  "queueId": "replace-with-resource-queueid",
  "type": "echo",
  "payload": "{}",
  "intervalMs": 1000
}
~~~

Client method: client.createSchedule(body, options?).

### controlSchedule

Enable or disable a schedule.

~~~http
PATCH /api/schedules/{id}
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-logical-request-key>
~~~

Path parameter id: resource identifier returned by a creation operation.

| Field | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| enabled | boolean | Yes | Enable future runs |
| revision | integer | Yes | Expected record revision. Minimum 1. Maximum 1000000000 |

Example body:

~~~json
{
  "enabled": true,
  "revision": 1
}
~~~

Client method: client.controlSchedule(id, body, options?).

### runScheduler

Reclaim leases and dispatch due schedules.

~~~http
POST /api/tick
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-logical-request-key>
~~~

| Field | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| None | object | Yes | Send an empty JSON object |

Example body:

~~~json
{}
~~~

Client method: client.runScheduler(body, options?).


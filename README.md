# Relay Queue

[![CI](https://github.com/sergheigindac/relay-queue/actions/workflows/ci.yml/badge.svg)](https://github.com/sergheigindac/relay-queue/actions/workflows/ci.yml)

Background work needs to survive process restarts and worker failures. Relay Queue coordinates producers and workers through a durable queue with bounded concurrency, explicit attempt ownership, and observable recovery.

This is a runnable, AI-assisted portfolio project using JavaScript, Node.js 24, SQLite, and Docker. It demonstrates multi-file service architecture and operational workflows for a single trusted tenant.

## Features

- Priority queues with pause/resume controls, concurrency limits, and delayed delivery.
- Fenced worker leases, heartbeat renewal, exponential retries, and dead-letter replay.
- Atomic batch enqueue and permanent per-queue deduplication keys.
- Dependency chains that release children after all parents succeed.
- Recurring fixed-delay schedules with missed-run coalescing.
- Queue draining, worker history, throughput reports, and attempt timelines.
- A runnable worker with echo, sum, and deliberate failure handlers.

The project includes an authenticated HTTP API, browser operations console, typed JavaScript client, audit log, online backup command, and automated tests. There are no third-party runtime packages.

## Run locally

Install Node.js 24.14.0 or a compatible Node 24 release. No npm install is needed.

POSIX shell:

~~~sh
export API_TOKEN=$(node scripts/token.js)
node src/main.js
~~~

PowerShell:

~~~powershell
$env:API_TOKEN = node scripts/token.js
node src/main.js
~~~

Open http://127.0.0.1:4310 and enter the token in the console. The database is stored at data/application.sqlite. The page keeps the token in memory and clears it on reload. Plain Node does not load .env automatically; export variables or run node --env-file=.env src/main.js.

## Run with Docker

~~~sh
cp .env.example .env
# Replace API_TOKEN in .env with a freshly generated random token.
docker compose up --build --wait
docker compose logs -f app
~~~

The image runs as a non-root user. Compose binds to localhost, mounts a persistent SQLite volume, and makes the root filesystem read-only. Image builds run the test suite before assembling the runtime stage.

Stop with docker compose down. Keep the volume to preserve records. Removing it permanently removes its database, so only do that for disposable demo data.

## Complete workflow

1. Create a queue named emails with concurrency 2.
2. Enqueue an echo job whose payload is a JSON string.
3. Claim work using a unique workerId. Save the returned leaseToken.
4. Complete the job with that token before leaseUntil.
5. Submit another job using the fail handler and observe its retries.
6. Pause the queue to stop new claims while existing leases continue.
7. Inspect queue statistics and the job history endpoint.

Automated demonstration:

~~~sh
node scripts/smoke.js
~~~

This starts an isolated server on a temporary port, exercises the workflow, and removes its temporary database. If API_URL is set, it uses that server and creates uniquely named demo records there instead.

## Validation

~~~sh
node scripts/check.js
node --test
node --test --experimental-test-coverage
node scripts/smoke.js
~~~

Tests cover transaction rollback, persistence, online backups, schema boundaries, authentication, idempotent retries, domain failure paths, and competing HTTP requests. CI runs on Windows and Linux and separately builds and exercises the Docker image.

## Repository guide

| Directory | Responsibility |
| --- | --- |
| src/core | SQLite, HTTP, validation, configuration, idempotency |
| src/domain | Business state machines, commands, queries, route definitions |
| public | Browser operations console with no frontend build step |
| client | Native fetch client and TypeScript request declarations |
| scripts | Smoke check, API client, backup, syntax checks, contract export |
| test | Unit, integration, concurrency, persistence, and transport tests |
| docs | Architecture, API reference, runbooks, decisions, and OpenAPI |

## Documentation

- [Architecture and invariants](docs/architecture.md)
- [API reference](docs/api.md)
- [Operational runbook](docs/operations.md)
- [Design decisions](docs/decisions.md)
- [Development guide](CONTRIBUTING.md)
- [Client usage](client/README.md)
- [OpenAPI contract](docs/openapi.json)

## Scope

- The supplied worker runs synchronous demonstration handlers. Long-running handlers need periodic lease renewal and cooperative cancellation.
- There is no arbitrary code execution, cron parser, distributed consensus, or broker replication.
- Worker reports reflect the last owner stored on each job, not complete per-worker performance history.
- Deduplication keys remain reserved while the job record exists. There is no automatic retention policy.
- Queue drain cancels pending work, including dependency-blocked jobs; active work continues.
- SQLite work is synchronous and collection queries scan records in memory. This favors readable local deployment over large-scale throughput.
- One bearer token has administrative access. There is no user directory, tenant isolation, role-based authorization, or built-in TLS.
- The portfolio projects share a small core implementation but have separate domain models and independent databases.
- Node 24 built-in SQLite is experimental. Keep the tested runtime pinned and validate upgrades.

Generated OpenAPI and client files are checked in for review and editor support. They count toward repository totals but are distinct from handwritten application code. Commit timestamps reflect actual development.

MIT licensed. See [LICENSE](LICENSE).

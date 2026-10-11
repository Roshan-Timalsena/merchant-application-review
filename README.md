# Merchant Application Service

NestJS backend for merchant application onboarding: JWT auth, role- and object-level authorization, BullMQ KYB checks, and an audit trail with redacted metadata.

## Stack

- **Runtime:** Node.js + NestJS 10
- **Database:** PostgreSQL + TypeORM (migrations)
- **Queue:** Redis + BullMQ (`risk-kyb` on submit)
- **Auth:** JWT, RBAC, CASL object-level policies
- **Validation:** class-validator / class-transformer
- **API docs:** OpenAPI/Swagger at `/merchant-application-service/api-docs`
- **Tests:** Jest (unit) + Jest/Supertest (e2e)

## Quick start (Docker Compose)

```bash
cp .env.example .env
docker compose up --build
```

- API: http://localhost:3000/api
- Health: http://localhost:3000/api/health
- Swagger: http://localhost:3000/merchant-application-service/api-docs

Migrations run automatically on API container start.

### Resetting the database

```bash
docker compose down -v
docker compose up --build
```

## Local development

```bash
docker compose up -d postgres redis
cp .env.example .env
npm install
npm run migration:run
npm run start:dev
```

Compose maps Redis to host port `16379` by default. Local `.env` should use `REDIS_PORT=16379` when talking to Compose Redis from the host.

## Roles and object-level rules

| Role | Access |
| --- | --- |
| `admin` | Full operational access |
| `reviewer` | Read applications; only the **assigned** reviewer may approve / reject / request-info |
| `sales` | Create and update **own** applications only; cannot approve |

Hard rules (also enforced in the service layer):

- SALES `GET`/`PATCH` of another user’s application by ID → **403**
- Non-assigned REVIEWER risk decision → **403**

### Dummy seed users (development only)

| Email | Role | Password |
| --- | --- | --- |
| `admin@example.com` | admin | `Password123!` |
| `reviewer@example.com` | reviewer | `Password123!` |
| `reviewer2@example.com` | reviewer | `Password123!` |
| `sales@example.com` | sales | `Password123!` |

## Merchant application lifecycle

Statuses: `draft` → `submitted` → `in_review` → (`approved` | `rejected` | `info_requested`). From `info_requested` → `submitted` again.

Editable content statuses: `draft`, `info_requested`.

| Method | Path | Who |
| --- | --- | --- |
| `POST` | `/api/merchant-application` | SALES, ADMIN |
| `GET` | `/api/merchant-application` | all (SALES scoped to own); `?status=&page=&limit=` |
| `GET` | `/api/merchant-application/:id` | owner SALES, REVIEWER, ADMIN |
| `PATCH` | `/api/merchant-application/:id` | owner SALES, ADMIN |
| `POST` | `/api/merchant-application/:id/submit` | owner SALES, ADMIN — enqueues KYB job |
| `POST` | `/api/merchant-application/:id/assign` | ADMIN — `{ reviewerId }` |
| `POST` | `/api/merchant-application/:id/update-status` | assigned REVIEWER, ADMIN — `{ status: approved\|rejected\|info_requested, riskStatus?, notes? }` |
| `GET` | `/api/merchant-application/:id/audit-logs` | ADMIN |

### Async KYB (BullMQ)

The `risk-kyb` BullMQ worker starts when the API process bootstraps and logs `Risk KYB worker ready`.

On **create**, the API sets `kybCheckStatus=pending`, `submissionVersion=1`, and enqueues a `risk-review` job (`jobId` `risk-kyb:{applicationId}:{version}`) with 5 attempts and exponential backoff. **Submit / resubmit** increments `submissionVersion` and enqueues again.

The worker loads the application (including `draft`), runs a simulated risk-provider check that randomly returns `LOW_RISK`, `HIGH_RISK`, or `MANUAL_REVIEW`, persists `kybResult` + `riskStatus`, and writes a SYSTEM audit event. Assignment is blocked until KYB is `completed`. `POST .../update-status` requires an assigned reviewer (ADMIN cannot decide until one is assigned).

### Audit trail and redaction

Significant actions are written to `audit_logs`: created, submitted, assigned, review_decision, kyb_completed.

Audit metadata never stores passwords, tokens, or raw secrets. Contact email/phone and owner name are masked before persist.

## Auth endpoints

- `POST /api/auth/register` — `{ "email", "password" }` (role `sales`)
- `POST /api/auth/login` — `{ "email", "password" }` → `{ accessToken, user }`

## Scripts

| Command | Description |
| --- | --- |
| `npm run start:dev` | Watch mode |
| `npm run build` | Compile |
| `npm run migration:run` | Apply migrations |
| `npm test` | Unit tests |
| `npm run test:e2e` | Integration tests (Postgres + Redis) |

## Project layout

```
src/
  auth/
  authorization/
  audit/
  common/security/   # redaction helpers
  merchant-applications/
  queues/
  users/
```

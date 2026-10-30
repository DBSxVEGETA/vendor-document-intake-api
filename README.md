# Vendor Document Intake API

A backend API for vendor invoice intake, extraction, validation, reviewer decisions, and payment webhook processing. Built with Node.js, Express, and PostgreSQL. The default extraction workflow is offline and does not require a paid or external AI API.

## 1. Features

### Implemented

- Express application and health endpoint.
- PostgreSQL connection and database migrations.
- Database schema for users, sessions, documents, and payment events.
- Vendor-only public registration and bcrypt password hashing.
- Login, JWT access tokens, random refresh tokens, refresh-token rotation, and session revocation on logout.
- Session-backed access-token invalidation after refresh; authentication checks session and active-user state.
- Role-based authorization for vendor, reviewer, and admin.
- Invoice intake through JSON text, TXT files, and text-based PDF files.
- 5 MB upload limit and PDF/TXT MIME-type filtering.
- Offline deterministic mock extractor for labelled invoice fields.
- PDF text extraction; scanned PDF/OCR is not supported.
- Invoice validation flags for missing fields, invalid/future dates, invalid/non-positive totals, and duplicate invoice numbers.
- Readable but invalid invoices are stored with `needs_review` status and validation flags.
- Duplicate invoice detection scoped to the vendor account.
- Vendor document listing and retrieval with ownership filtering; reviewer/admin access across vendors.
- Reviewer/admin approval and rejection; rejection requires a reason.
- Payment webhook HMAC-SHA256 verification over the raw request body.
- Payment event idempotency using a unique event ID and transactional processing.
- Payment amount verification; only approved documents can transition to paid.
- Centralized Express error-handling middleware.
- Database seed script for sample users, documents in different statuses, and a sample payment event.
- Postman collection for manually exercising the API endpoints.

### Not implemented / not confirmed

- Automated integration test suite. The small `src/scripts/test-*.js` files are development checks, not a complete automated API test suite.
- Admin user-management endpoints (create users, change roles, deactivate users).
- Summary caching and cache invalidation.
- Audit log for reviewer/admin actions.
- OCR for scanned PDFs.
- Real payment provider integration.
- Production deployment, monitoring, and rate limiting.

## 2. Technology

- Node.js and Express
- PostgreSQL and `pg`
- `node-pg-migrate`
- bcrypt
- jsonwebtoken
- Multer
- pdf-parse
- Node.js `crypto`

## 3. Project structure

The exact tree may evolve. Main application areas:

```text
src/
  config/
    database.js
  middleware/
    authenticate.js
    authorize.js
    errorHandler.js
    upload.js
  modules/
    auth/
    documents/
      extractors/
    reports/
    webhooks/
      payment/
  routes/
  scripts/
    check-db.js
    seed.js
    test-extractor.js
    test-validator.js
    test-document-service.js
    generate-webhook-signature.js
  app.js
  server.js
migrations/
```

## 4. Prerequisites

- Node.js (the project was developed with Node.js 22)
- npm
- PostgreSQL
- Postman (recommended for API testing)

## 5. Local setup

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd vendor_document_intake_API
npm install
```

Create a PostgreSQL database, for example:

```sql
CREATE DATABASE vendor_document_intake;
```

Copy `.env.example` to `.env` and configure the local database credentials and secrets.

Run migrations and seed sample data:

```bash
npm run db:migrate
npm run db:seed
```

Check the database connection and start the API:

```bash
npm run check:db
npm run dev
```

For normal startup:

```bash
npm start
```

Check the health endpoint:

```http
GET http://localhost:3000/health
```

Confirm the available npm scripts in `package.json` if they differ from the commands above.

## 6. Environment variables

Use `.env.example` as a template. Never commit `.env` or real credentials.

| Variable                        | Purpose                               |
| ------------------------------- | ------------------------------------- |
| `PORT`                          | API port; development default is 3000 |
| `NODE_ENV`                      | Runtime environment                   |
| `PGHOST`                        | PostgreSQL host                       |
| `PGPORT`                        | PostgreSQL port                       |
| `PGDATABASE`                    | Database name                         |
| `PGUSER`                        | PostgreSQL username                   |
| `PGPASSWORD`                    | PostgreSQL password                   |
| `ACCESS_TOKEN_SECRET`           | JWT signing secret                    |
| `ACCESS_TOKEN_EXPIRES_IN`       | Access-token lifetime                 |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | Refresh-session lifetime              |
| `WEBHOOK_SECRET`                | Shared HMAC webhook secret            |

Generate secrets locally, for example:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Use placeholders in `.env.example`. Do not commit `.env`, database passwords, JWT secrets, or webhook secrets.

## 7. Seed data and local test accounts

After migrations, run:

```bash
npm run db:seed
```

The seed script is intended to create/update a repeatable local evaluation dataset:

- Two vendor accounts
- One reviewer account
- One admin account
- Sample documents covering extracted, needs_review, approved, rejected, and paid statuses
- A sample payment event associated with the paid document

Development credentials configured by the seed script:

| Role     | Email                  | Password        |
| -------- | ---------------------- | --------------- |
| Vendor 1 | `vendor1@example.com`  | `VendorAPI@123` |
| Vendor 2 | `vendor2@example.com`  | `VendorAPI@123` |
| Reviewer | `reviewer@example.com` | `VendorAPI@123` |
| Admin    | `admin@example.com`    | `VendorAPI@123` |

These are local evaluation credentials only. Change or remove them before any public deployment. The seed script should be run only against a development/test database.

## 8. Authentication and roles

- **Vendor:** register, log in, upload invoices, list/view own documents.
- **Reviewer:** list/view documents across vendors and approve/reject eligible documents.
- **Admin:** reviewer capabilities. Dedicated user-management endpoints should be treated as pending unless present in the submitted code.

Public registration always creates a vendor; a client cannot self-assign reviewer/admin permissions.

| Method | Endpoint             | Purpose                                         |
| ------ | -------------------- | ----------------------------------------------- |
| POST   | `/api/auth/register` | Register vendor                                 |
| POST   | `/api/auth/login`    | Login                                           |
| POST   | `/api/auth/refresh`  | Rotate refresh token and issue new access token |
| POST   | `/api/auth/logout`   | Revoke current session                          |

Protected APIs use:

```http
Authorization: Bearer <access-token>
```

Refresh tokens are random opaque values; only their hashes are stored. Refresh rotation invalidates the previous refresh token and previous access token through session versioning. Logout revokes the session.

## 9. Document APIs

| Method | Endpoint                     | Access                  | Description                               |
| ------ | ---------------------------- | ----------------------- | ----------------------------------------- |
| POST   | `/api/documents`             | vendor                  | Upload PDF/TXT or submit JSON text        |
| GET    | `/api/documents`             | vendor, reviewer, admin | List accessible documents                 |
| GET    | `/api/documents/:id`         | vendor, reviewer, admin | Retrieve a document with ownership checks |
| PATCH  | `/api/documents/:id/approve` | reviewer, admin         | Approve eligible document                 |
| PATCH  | `/api/documents/:id/reject`  | reviewer, admin         | Reject eligible document; reason required |

The list endpoint supports pagination using `page` and `limit`. Vendor access is restricted in SQL to that vendor's own documents. A vendor requesting another vendor's document receives 404.

### JSON upload example

```json
{
  "text": "Vendor: ABC Technologies\nInvoice Number: INV-2026-101\nDate: 2026-10-20\nTotal: 15000.50"
}
```

### File upload

Use `multipart/form-data` with the field name `document`. Supported types are PDF and TXT, maximum size 5 MB. PDF extraction supports text-based PDFs only.

The mock extractor expects labelled lines such as:

```text
Vendor: ABC Technologies
Invoice Number: INV-2026-101
Date: 2026-10-20
Total: 15000.50
```

Readable invoices with validation issues are saved as `needs_review` with flags. Unreadable/empty documents return 422 and are not saved. Duplicate invoice numbers are flagged within the same vendor account.

## 10. Payment webhook

```http
POST /webhooks/payment
Content-Type: application/json
X-Signature: <hex HMAC-SHA256 signature>
```

Example body:

```json
{
  "eventId": "PAYMENT-EVENT-001",
  "documentId": "<document-uuid>",
  "amount": "17000.00"
}
```

The signature is computed over the exact raw HTTP request body using `WEBHOOK_SECRET`. The API verifies the signature using HMAC-SHA256 and a timing-safe comparison.

The Postman collection includes a pre-request script that generates `X-Signature` from the raw request body and a Postman environment variable named `webhookSecret`. Set that variable to the same local value as `WEBHOOK_SECRET`; do not hardcode the secret in the collection.

A repeated event ID is handled idempotently. Only an approved document with a matching amount can become paid. Validly signed business rejections (invalid document state or amount mismatch) are recorded and return 409. Invalid signatures return 401.

This is a simulated payment-provider workflow for the assignment; no real payment processor is connected.

## 11. Postman API collection

Import the committed Postman collection and its environment, if included in the repository.

Recommended testing order:

1. Health check.
2. Register/login or use seeded accounts.
3. Vendor uploads a TXT/PDF/JSON invoice.
4. Vendor lists and retrieves own documents.
5. Vendor A attempts to retrieve Vendor B's document (expect 404).
6. Vendor attempts reviewer-only approval (expect 403).
7. Reviewer approves/rejects eligible documents.
8. Payment webhook: valid signature, duplicate event ID, invalid signature, amount mismatch, and non-approved document.
9. Test pagination and role-based report endpoint only if that endpoint is implemented.

The Postman pre-request script generates the webhook signature automatically. The local `generate-webhook-signature.js` utility can remain as an alternate manual development tool.

## 12. Database

The initial schema includes `users`, `sessions`, `documents`, and `payment_events`. Invoice totals use PostgreSQL `NUMERIC(12,2)`. The webhook event ID has a unique constraint to enforce idempotency.

Migrations:

```bash
npm run db:migrate
```

Seed:

```bash
npm run db:seed
```

## 13. Development checks vs automated tests

The repository contains small development scripts used to verify individual pieces, such as database connectivity, extraction, validation, document persistence, and webhook signature generation.

These scripts are not a formal automated integration test suite. The primary end-to-end API verification is performed through the Postman collection. Keep useful development scripts in `src/scripts/`; remove only temporary scripts that are obsolete, contain hardcoded secrets, or are not safe to run. Ensure each script is documented and does not run automatically when the server starts.

## 14. Known limitations and deferred work

- Mock extraction handles labelled invoice text, not arbitrary invoice layouts.
- No OCR for scanned PDFs.
- No real payment processor integration.
- No formal automated integration test suite; API scenarios are exercised through Postman.
- Admin bootstrap/user-management endpoints may be limited to local seed provisioning.
- Summary caching and invalidation are not implemented.
- Audit logging is not implemented.
- Duplicate detection uses a read-before-insert check and may need stronger concurrency protection for simultaneous uploads.
- Confirm monthly report implementation and tests before documenting it as complete.
- OpenAPI/Swagger documentation and a committed Postman collection/environment should be included in the repository.
- Production deployment, rate limiting, monitoring, and production secret rotation are outside the current scope.

## 15. If given another week

1. Add automated integration tests for authentication, RBAC, ownership, validation, state transitions, and webhook retries/concurrency.
2. Add secure admin user-management endpoints and role-change auditing.
3. Complete and test monthly vendor reports and add role-safe caching/invalidation.
4. Add audit logs for reviewer/admin actions and payment processing.
5. Strengthen concurrent duplicate-invoice detection.
6. Add OpenAPI documentation, CI, and Docker Compose.
7. Add OCR or configurable extraction only if permitted by the deployment environment.

## 16. AI assistance disclosure

### AI Usage Disclosure

AI tools, including ChatGPT, were used during the development of this project as an assistance tool. Their use included brainstorming and planning the application architecture, breaking down requirements, exploring implementation approaches, understanding technical concepts, generating code suggestions and examples, debugging errors, reviewing implementation choices, improving documentation, and preparing project decisions.

AI assistance was also used to discuss database design, authentication and authorization, document validation, payment webhook handling, API structure, and testing scenarios.

All AI-generated suggestions and code were reviewed, adapted, and integrated as appropriate. The implementation, local setup, configuration, and manual testing were carried out by the author, who is responsible for the final code and design decisions.

The application uses a deterministic mock document extractor by default, so it does not depend on an external paid AI API at runtime.

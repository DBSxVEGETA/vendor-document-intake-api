# Engineering Decisions

This document records the major design choices made for the Vendor Document Intake API, their rationale, trade-offs, and remaining considerations.

## 1. PostgreSQL and exact monetary values

**Decision:** Use PostgreSQL as the primary database and parameterized SQL through `pg`. Store invoice totals using `NUMERIC(12,2)`.

**Rationale:**

- Users, sessions, documents, and payment events are relational data.
- Foreign keys and transactions help maintain referential integrity.
- A unique constraint on payment event IDs enforces webhook idempotency at the database layer.
- PostgreSQL can perform monthly aggregations without loading all records into application memory.
- `NUMERIC` avoids binary floating-point rounding errors for invoice amounts.

**Trade-offs:**

- SQL and migrations require explicit schema design.
- Direct SQL gives control and makes queries visible, but requires parameterization and careful testing.
- Monetary calculations should remain decimal strings/SQL numeric values rather than JavaScript floating-point arithmetic.

## 2. Session-backed JWT authentication and refresh-token rotation

**Decision:** Use short-lived JWT access tokens and cryptographically random refresh tokens. Store only a hash of each refresh token in the `sessions` table.

**Rationale:**

- Passwords are hashed with bcrypt.
- Refresh tokens are opaque credentials; storing their hashes reduces exposure if the database is read.
- Session checks allow logout and inactive-user checks to invalidate credentials.
- Access-token versioning invalidates an old access token after refresh instead of waiting for its expiry.
- Database row locking serializes concurrent refresh attempts for the same session.

**Trade-offs:**

- Protected requests need a database lookup, so JWTs are not fully stateless.
- The lookup enables immediate session revocation and active-user checks, which are valuable for the assignment's security requirements.
- Clients must replace their refresh token after each successful rotation.

## 3. Public registration is vendor-only

**Decision:** Public registration always creates a vendor account. The request cannot assign reviewer/admin roles.

**Rationale:** Prevents users from self-assigning privileged roles. Role access is enforced by backend middleware.

**Trade-offs / remaining work:** Reviewer/admin test users are provisioned through the seed script. Dedicated admin user-management endpoints and audited role changes are not part of the confirmed implementation and should be added before production.

## 4. Offline mock extraction behind a replaceable boundary

**Decision:** Use a deterministic mock extractor for labelled invoice fields and PDF text extraction for text-based PDFs.

**Rationale:**

- The assignment expects local/offline execution and disallows reliance on paid/external APIs.
- Deterministic extraction makes local verification repeatable.
- Keeping extraction separate from validation and persistence allows another extractor to be added without rewriting the rest of the workflow.

**Trade-offs:**

- Label-based parsing does not handle arbitrary invoice layouts.
- Scanned PDFs require OCR, which is out of scope.
- No external AI service is required for the default path.

## 5. Persist readable invoices that need review

**Decision:** Save readable invoices even when validation finds missing or invalid fields. Set status to `needs_review` and store validation flags. Return 422 without saving when content cannot be read. Duplicate invoice numbers are flagged per vendor.

**Rationale:** Human reviewers need visibility into incomplete or duplicate submissions rather than having them silently discarded. Flags explain why a document needs attention.

**Trade-offs:**

- Consumers must check document status and flags.
- Duplicate detection currently uses a read-before-insert check and can race under simultaneous uploads; stronger concurrency protection is future work.
- Vendor ownership is enforced in SQL for list and retrieval queries.

## 6. Conditional reviewer state transitions

**Decision:** Approve/reject operations update only documents whose current status is `extracted` or `needs_review`. Rejection requires a reason.

**Rationale:** A conditional database update enforces the allowed transition and reduces read-then-write race conditions. Missing documents return 404; invalid transitions return 409.

**Trade-offs:** A follow-up existence query distinguishes missing documents from invalid state transitions. A dedicated state-machine abstraction and audit trail would improve extensibility.

## 7. HMAC webhook verification and idempotency

**Decision:** Verify HMAC-SHA256 over the exact raw HTTP request body, compare signatures using a timing-safe function, and use a unique payment event ID with transactional processing and a row lock on the document.

**Rationale:**

- Raw-body verification ensures the signature covers exactly the bytes received.
- A unique event ID prevents provider retries from applying a payment more than once.
- A transaction keeps the event record and document transition consistent.
- Locking the document serializes concurrent payment attempts.
- Amount comparison uses PostgreSQL numeric arithmetic.
- Only an approved document with a matching amount can transition to paid.

**Trade-offs:**

- The assignment uses a simulated provider; Postman generates local signatures with the shared secret.
- Validly signed business rejections (wrong state or amount mismatch) are recorded and return 409.
- Invalid signatures are rejected before processing.
- A real integration would require provider-specific payload validation, secret rotation, and operational monitoring.

## 8. Centralized error handling

**Decision:** Controllers pass errors to a dedicated Express error-handling middleware.

**Rationale:** Keeps controllers focused on request handling and centralizes HTTP error response formatting, including upload errors.

**Trade-offs / future work:** A custom application error class and structured logging would improve consistency. Logs must not expose passwords, tokens, webhook secrets, or sensitive invoice data.

## 9. Seed data and repeatable local evaluation

**Decision:** Provide a seed script that creates a stable set of vendor, reviewer, and admin accounts, documents in different lifecycle states, and a sample payment event.

**Rationale:** A reviewer can populate a local database with one command and test role boundaries and document lifecycle behaviour without manually creating every record.

**Trade-offs:**

- Seed credentials are intentionally development-only and must never be used in production.
- The seed command should run only against a local/test database.
- The script should be idempotent so repeated runs do not create duplicate sample records.

## 10. Manual Postman verification under the timebox

**Decision:** Use a Postman collection with environment variables and a pre-request HMAC script for end-to-end manual API verification. Keep small Node scripts for focused development checks.

**Rationale:** This provides a reproducible way to exercise endpoints and role scenarios within the assignment timebox. The Postman pre-request script avoids manually generating webhook signatures for every request.

**Trade-offs / remaining work:**

- Manual Postman tests are not a substitute for a CI-executed automated integration test suite.
- The collection and environment should be committed with secrets removed.
- Automated tests should be added for critical RBAC, ownership, validation, state-transition, and webhook concurrency scenarios.

## 11. Scope choices under the assignment timebox

**Decision:** Prioritize authentication/RBAC, document intake and validation, reviewer decisions, and payment webhook idempotency. Provide seed data and a Postman collection for repeatable evaluation.

**Deferred or requiring final verification:**

- Formal automated integration test suite.
- Admin user-management endpoints.
- Monthly report endpoint verification/completion.
- Summary caching and invalidation.
- Audit logging.
- Stronger concurrent duplicate-invoice protection.
- OpenAPI documentation, Docker Compose, CI, rate limiting, and production deployment.

Deferred items are not represented as completed. The submitted README should clearly distinguish implemented functionality, manually tested functionality, and unfinished work.

# Architecture Decisions

This document records important technical decisions, alternatives considered, and the reasoning behind the choices.

## Decision 1: PostgreSQL and Direct SQL

Status: Implemented

- Context: The application requires relational data, transactions,
  exact monetary values and database-enforced uniqueness.
- Decision: Use PostgreSQL with the Node.js pg driver.
- Alternatives considered: MongoDB and an ORM-based approach.
- Trade-offs: Direct SQL provides greater control and transparency,
  but requires us to manage queries and migrations explicitly.

## Decision 2: Session-Based Token Invalidation

Status: Schema implemented; authentication pending.

- Context: Logout must invalidate both access and refresh tokens.
- Decision: Maintain a database session record for each login.
  Access tokens reference the session ID, and middleware checks
  that the session remains active.
- Alternatives considered: JWT denylist and user token version.
- Trade-offs: Requires a database lookup during authenticated
  requests, but allows immediate session revocation.

## Decision 3: Payment Event Uniqueness

Status: Schema implemented; webhook pending.

- Context: Payment providers may send the same webhook repeatedly.
- Decision: Enforce a unique constraint on payment_events.event_id.
- Alternatives considered: Application-only duplicate checks.
- Trade-offs: Database uniqueness protects against concurrent
  duplicate requests. Processing will also require transactions.

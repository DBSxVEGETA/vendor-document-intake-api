
# Vendor Document Intake API

A backend API for vendor invoice intake, data extraction, finance review, approval, and payment tracking.

## Project Status

Initial project setup. Implementation has not started yet.

## Objectives

- Authenticate users and enforce role-based access control.
- Accept invoice text or PDF uploads and extract invoice fields.
- Validate extracted data and flag suspicious invoices for review.
- Support invoice approval, rejection, and payment tracking.
- Generate monthly vendor summaries with caching.
- Handle payment webhooks securely and idempotently.

## Technology Stack

- Node.js
- Express.js
- PostgreSQL
- JWT and bcrypt
- Jest and Supertest
- Swagger/OpenAPI

The extractor will use a deterministic mock implementation by default so the application and tests can run without external API keys or network access.

## Architecture

The application will use separate layers for routes, middleware, controllers, business services, data access, and invoice extraction.

The extractor will be implemented behind a common interface so that the mock implementation can be replaced without changing the rest of the application.

## Development Plan

1. Repository setup and project documentation.
2. Application bootstrap and database schema.
3. Authentication and role-based access control.
4. Invoice extraction, validation, and persistence.
5. Review workflows and document state transitions.
6. Payment webhook signature verification and idempotency.
7. Monthly reporting, caching, and cache invalidation.
8. Integration tests, API documentation, and final verification.

Implementation order may change based on dependencies and the time available.

## Running the Project

Setup and execution instructions will be added as the application is implemented.

## Testing

Automated tests will be added incrementally. The final test command and database setup instructions will be documented here.

## Known Limitations

No application features have been implemented yet.

## Architectural Decisions

See [DECISIONS.md](DECISIONS.md) for design choices and trade-offs.

## AI Usage

AI tools may be used for brainstorming, explaining concepts, reviewing implementation ideas, and debugging. Actual usage and any code suggestions adopted or rejected will be documented accurately before submission.

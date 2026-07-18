# Phase 11 — Recruitment public endpoints

Base: `http://localhost:4001/api/v1`

## Browse

```http
GET /recruitment/postings/open
GET /recruitment/postings/open/00000000-0000-4000-8000-000000000101
```

## Apply (no Authorization)

```http
POST /recruitment/applications
{
  "postingId": "00000000-0000-4000-8000-000000000101",
  "applicantName": "Ada Applicant",
  "email": "ada@example.com",
  "phone": "+255700111222",
  "coverLetter": "I am ready."
}
```

Returns `referenceNumber` (e.g. `APP-2026-000001`) and `status: SUBMITTED`.

## Status

```http
GET /recruitment/applications/status?reference=APP-2026-000001&email=ada@example.com
```

Safe fields only: `referenceNumber`, `status`, `postingTitle`, `submittedAt`.

## Admin hire

Requires Bearer admin token — not exposed on recruitment-web.

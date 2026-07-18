# Phase 11 — Recruitment Portal (`recruitment-web` :3004)

## Goal

Public **careers** portal for HIGHLINK applicants. Portal ≠ microservice — APIs on **core-api :4001** only.

| App | Port | Auth |
|---|---|---|
| `recruitment-web` | 3004 | **Public only** (visitor-web pattern) |
| Admin hire/pipeline | admin API | Bearer + `recruitment.manage` |

## Research applied

- Public job board + guest apply (community ATS / QuickHire pattern) — no candidate account for v1
- Confirmation shows **referenceNumber** only; status lookup requires reference **+ email** (second factor)
- Hire never on portal — stays admin (creator ≠ portal hire)

## Public APIs

| Method | Path |
|---|---|
| GET | `/recruitment/public-config` |
| GET | `/recruitment/postings/open` |
| GET | `/recruitment/postings/open/:id` |
| POST | `/recruitment/applications` (org from OPEN posting) |
| GET | `/recruitment/applications/status?reference=&email=` |

## Admin-only

`GET /recruitment/applications`, `PATCH …/status`, `POST …/hire`, create postings.

## Seed

- Posting `00000000-0000-4000-8000-000000000101` — Security Guard
- Posting `…102` — Site Supervisor

## Deferred

B2B other-company portal, Keycloak candidate login, MinIO CV upload, guard-app Expo offline (Phase 12+).

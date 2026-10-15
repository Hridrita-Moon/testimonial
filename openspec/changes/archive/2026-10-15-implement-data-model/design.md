# Design

## Context

Today `prisma/schema.prisma` is a working init scaffold (one migration applied to `prisma/dev.db`) that already contains the six tables in roughly the right shape, but it is missing five decisions from the design interview (see `data-model.md` §13): `Subscription.@@unique([userId])`, `Subscription.cancelAtPeriodEnd`, `EmbedConfiguration.@@unique([spaceId])`, `Testimonial.@@index([spaceId, submissionTimestamp])`, `Testimonial.@@index([spaceId, isWallOfLove, visibilityStatus])`, and `SpaceField.@@index([spaceId, displayOrder])`. The dev SQLite DB is uncommitted (lives under `prisma/dev.db`), Prisma is 6.19, and `package.json` has `prisma` and `@prisma/client` already. `next` is 16.4 but no app code yet touches the Prisma client beyond the init migration. The proposal covers motivation — this design covers how to land the schema changes safely.

## Goals / Non-Goals

**Goals:**

- Bring `prisma/schema.prisma` into full alignment with `data-model.md` (column shapes, defaults, relations, indexes, enum-like value lists documented as constants in code).
- Apply the changes to `prisma/dev.db` with a single, named migration that preserves the init migration history.
- Regenerate `@prisma/client` so downstream code type-checks.
- Leave a clean foundation for follow-up changes: plan limits enforcement, public submit route, Stripe webhook, embed endpoint, and seed/reset.

**Non-Goals:**

- Implementing service-layer plan limits (`lib/enforce-limits.ts`).
- Implementing any of the API routes (public submit, wall of love, embed, Stripe webhook, dashboard CRUD).
- Wiring up authentication / sessions.
- Seeding the §12 sample-data walkthrough (separate follow-up change).
- Renaming or removing any of the six tables or columns.
- Editing `openspec/specs/` — this change introduces the first spec; no existing specs to modify.

## Decisions

### Decision: One new migration, not a reset

The change adds a single migration directory under `prisma/migrations/`, applied with `prisma migrate dev`. The init migration `20261014101619_init` is preserved. We do **not** reset the database because the dev DB has no production data and other developers' local copies are not committed, but resetting would destroy any in-progress manual fixtures and obscure the audit trail of how the schema evolved. The new migration is named to describe the change: indexes + uniqueness.

**Alternatives considered:**

- `prisma db push` with schema reset → rejected: doesn't produce a migration, can't be replayed on a fresh DB, and bypasses the migration history the project wants.
- Delete the init migration and re-create from a single baseline → rejected: loses provenance and would require everyone to delete their dev DB.

### Decision: Edit `prisma/schema.prisma` in place, not via a separate `schema.prisma` patch file

Prisma reads `schema.prisma` as the source of truth. Any drift between a written-down patch and the schema file is a footgun. We edit the file directly and let `prisma migrate dev` generate the migration SQL from the diff.

### Decision: Keep SQLite as the dev datasource; document Postgres as production

`datasource db { provider = "sqlite" url = .env("DATABASE_URL") }` stays as-is. `data-model.md` §1 commits to Postgres in production. The schema is compatible with both — `Json` columns map to `jsonb` on Postgres and `JSON` on SQLite, both indexes are valid on both providers, and the unique constraints are enforced on both. A future change adds a Postgres-backed `schema.production.prisma` or switches the provider via env-driven datasource.

### Decision: Enum-like values stay as `String` columns

`Space.theme`, `SpaceField.fieldType`, `Testimonial.visibilityStatus`, `Subscription.plan`, `Subscription.status`, `EmbedConfiguration.layout`, `EmbedConfiguration.themeMode` are kept as `String` rather than Prisma `enum`s. This is consistent with `data-model.md` §4–§8 ("Enum-like"), avoids a Postgres-vs-SQLite enum mismatch, and keeps the door open for v2 additions (e.g., new `visibilityStatus` like `archived`) without a destructive migration. Application-layer validation enforces the closed sets; tests in the follow-up changes cover them.

### Decision: `additionalValues` is a JSON column, not a relational table

`Testimonial.additionalValues` is `Json?` storing `{ companyName?, socialLinks?, profilePhoto? }`. The interview (Q3, Option A) and `data-model.md` §6 lock this decision. The shape is open enough to grow without a schema migration but bounded enough that public endpoints can serialize it directly.

### Decision: No `displayOrder` on `Testimonial`

Inbox ordering is computed (`isFavorite DESC, submissionTimestamp DESC`) per `data-model.md` §6 / Q5. Adding the column now would be YAGNI and contradicts the agreed design.

### Decision: Embed configuration is keyed by `EmbedConfiguration.id`, not `Space.id`

The public embed JS snippet references `EmbedConfiguration.id` so a future v2 can support more than one embed variant per space (the unique constraint is enforced for MVP but the identifier is the embed config, not the space). See `data-model.md` §8 / Q7.

### Decision: Constants in code, not in the database

`PLAN_LIMITS` (free / premium → max spaces, max testimonials per space, price display) lives in `lib/plan-limits.ts` per `data-model.md` §10. The data model intentionally does not carry a `Plan` table; that's a v2 concern. The schema is unchanged by this decision; only the design acknowledges where the limits live.

## Risks / Trade-offs

- **SQLite index length limits on `additionalValues`** → SQLite has no JSONB indexes; we don't add one. None of the documented read paths filter on `additionalValues`. Mitigation: the public Wall of Love and embed endpoints project to a flat shape and never query inside the JSON.
- **Cascade delete is destructive** → deleting a user wipes their spaces, testimonials, and subscription. This is correct for MVP per `data-model.md` §4–§7. Mitigation: real "delete account" UI is gated behind a confirmation, and we don't ship one in this change.
- **`@@unique([userId])` on `Subscription` will fail the migration if duplicate rows are present** → there are none (the dev DB only has the init schema with no rows). Mitigation: if a developer has seeded duplicates locally, the migration errors with a clear message and they delete the rows before re-running.
- **Application-layer enforcement of enum-like values and 1–5 rating** → a follow-up change wires validation. Until then, a direct DB write could insert invalid values. Mitigation: the change does not introduce any code that writes to those columns yet, and follow-up changes add zod / similar validation at the API boundary.
- **Drift between `data-model.md` and `prisma/schema.prisma`** → mitigated by this change: after apply, the schema matches the document. Future drift is a code-review concern, not a design concern.
- **`@@unique([spaceId])` on `EmbedConfiguration` requires that no space ever has more than one row** → the dev DB has no embed configs yet, so the migration applies cleanly. Mitigation: a future "create space" handler will create the embed config in the same transaction as the space; backfill is out of scope.

## Migration Plan

1. Edit `prisma/schema.prisma` to add the five missing schema elements from `data-model.md` §13 and to confirm the rest of the column shapes match `data-model.md` §3–§8.
2. Run `npx prisma migrate dev --name <descriptive-name>` against `prisma/dev.db`. Prisma generates the migration SQL in `prisma/migrations/<timestamp>_<name>/migration.sql` and applies it. Review the generated SQL for correctness (it should only contain the five diffs and the supporting unique index where Prisma requires it).
3. Run `npx prisma generate` to regenerate `@prisma/client`. (The `postinstall` script already runs `prisma skills sync`, which is a no-op for our case.)
4. Verify with a smoke check: `npx prisma studio` (optional) and a one-line `tsc --noEmit` to ensure no consumer of `@prisma/client` broke. There are no consumers yet besides the Prisma client itself, so this should pass trivially.
5. **Rollback**: if the migration fails or the diff is wrong, `prisma migrate resolve --rolled-back <name>` marks the migration as not applied, then revert the schema edit. The init migration is untouched.

## Open Questions

None. The five schema decisions, the dev/prod datasource split, the embed identifier choice, and the absence of a `displayOrder` on `Testimonial` are all locked by `data-model.md`. No decision in this design is contingent on an unresolved question.
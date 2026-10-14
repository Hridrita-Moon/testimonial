# Tasks

## 1. Schema alignment with data-model.md

- [x] 1.1 Edit `prisma/schema.prisma` to add `Subscription.cancelAtPeriodEnd Boolean @default(false)` and verify the field is present on the `Subscription` model and absent from the existing init migration (i.e., a `prisma migrate diff` against the new schema shows it as an added column).
- [x] 1.2 Edit `prisma/schema.prisma` to add `@@unique([userId])` on `Subscription` and verify the constraint compiles by running `npx prisma validate` (expect exit code 0 and no errors).
- [x] 1.3 Edit `prisma/schema.prisma` to add `@@unique([spaceId])` on `EmbedConfiguration` and verify by running `npx prisma validate` (expect exit code 0 and no errors).
- [x] 1.4 Edit `prisma/schema.prisma` to add `@@index([spaceId, submissionTimestamp])` on `Testimonial` and verify by reading the schema file back and confirming the index block is on the `Testimonial` model.
- [x] 1.5 Edit `prisma/schema.prisma` to add `@@index([spaceId, isWallOfLove, visibilityStatus])` on `Testimonial` and verify by reading the schema file back and confirming both `Testimonial` indexes are present in the right order.
- [x] 1.6 Edit `prisma/schema.prisma` to add `@@index([spaceId, displayOrder])` on `SpaceField` and verify by reading the schema file back and confirming the index block is on the `SpaceField` model.

## 2. Migration generation and apply

- [x] 2.1 Run `npx prisma migrate dev --name add_data_model_invariants` against `prisma/dev.db` and verify (a) a new directory `prisma/migrations/<timestamp>_add_data_model_invariants/` is created and (b) the migration is recorded in `_prisma_migrations` (Prisma prints "Your database is now in sync with your schema" on success).
- [x] 2.2 Open the new `migration.sql` and verify the SQL contains exactly the five diffs from `data-model.md` §13: a `Subscription_cancelAtPeriodEnd` column add, a `Subscription_userId_key` unique index, an `EmbedConfiguration_spaceId_key` unique index, two `Testimonial` composite indexes, and one `SpaceField` composite index — and nothing else (no unintended drops or renames).
- [x] 2.3 Run `npx prisma generate` and verify it completes with no errors and `@prisma/client` is regenerated under `node_modules/.prisma/client/`.

## 3. Schema–document reconciliation check

- [x] 3.1 Diff `prisma/schema.prisma` column-by-column against the column tables in `data-model.md` §3–§8 and verify every documented column exists with the documented type, optionality, default, and relation; record any divergence in the change notes (expect zero).
- [x] 3.2 Confirm no column or table has been renamed or removed by running `npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --shadow-database-url $DATABASE_URL` and verifying the diff is empty against the current migration history (expect: "No difference detected.").

## 4. Smoke verification

- [x] 4.1 Run `npx tsc --noEmit` from the project root and verify it exits 0 with no type errors, confirming `@prisma/client` consumers still type-check after regeneration.
- [x] 4.2 Run `npx prisma db execute --stdin --url $DATABASE_URL <<< "SELECT name FROM sqlite_master WHERE type='index';"` (or open `prisma/dev.db` with `npx prisma studio`) and verify the three new `Testimonial`/`SpaceField` composite indexes and the two new unique indexes are listed.
- [x] 4.3 Run `npx openspec validate implement-data-model --strict` from the project root and verify it exits 0 with no validation errors against the proposal, spec, design, and tasks artifacts.
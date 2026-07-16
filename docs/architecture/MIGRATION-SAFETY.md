# Migration Safety — FULLTEXT-Indexed Tables

Reference doc for a real, measured production risk: `ALTER TABLE`
migrations on a table with a `FULLTEXT` index can silently require
MySQL's slowest, most disruptive DDL algorithm. Read this **before**
writing any migration that touches `articles`, or any table that later
gains a `FULLTEXT` index. See
[`docs/adr/E8-fulltext-migration-safety-net.md`](../adr/E8-fulltext-migration-safety-net.md)
for the decision record.

## The problem, measured

MySQL 8.0.29+ (this platform runs 8.4.3) can perform most `ALTER TABLE`
operations near-instantly via `ALGORITHM=INSTANT`, or without a full
table copy via `ALGORITHM=INPLACE`. **Tables with a `FULLTEXT` index
lose both options** for many `ALTER TABLE` operations — InnoDB only
supports building/altering one FULLTEXT-related structure at a time,
so MySQL falls back to `ALGORITHM=COPY`: a full table rebuild that
holds a lock blocking writes for its entire duration.

Measured directly against the real `articles` table (217,460 rows, one
`FULLTEXT` index on `title`):

```
ALGORITHM=INSTANT → rejected (error 1846)
ALGORITHM=INPLACE → rejected (error 1846)
ALGORITHM=COPY    → accepted, 177 seconds, write-blocking
```

This is not hypothetical: a pre-Phase-1 migration
(`2026_05_19_150000_add_content_json_to_articles_table.php`) already
used `->change()` on this table and likely paid this same cost,
unmeasured and unplanned, at the time.

## Current inventory (verified, not assumed)

As of this writing, **`articles` (on `title`) is the only table in the
schema with a `FULLTEXT` index.** Verified by scanning every table's
indexes, not just checking the known one — re-run this if you're
unsure it's still current:

```php
foreach (DB::select('SHOW TABLES') as $t) {
    $name = $t->{'Tables_in_' . env('DB_DATABASE')};
    $idx = DB::select("SHOW INDEX FROM `{$name}` WHERE Index_type = 'FULLTEXT'");
    if (count($idx) > 0) {
        echo $name . ': ' . implode(',', array_unique(array_map(fn($i) => $i->Column_name, $idx))) . PHP_EOL;
    }
}
```

## Checklist — before writing a migration

Run through this for **any** migration that runs `Schema::table(...)`
(not `Schema::create(...)` — brand-new tables have no existing rows to
rebuild) against a table that might have a `FULLTEXT` index:

- [ ] **Does the target table have a `FULLTEXT` index?** Run
      `SHOW INDEX FROM {table} WHERE Index_type = 'FULLTEXT'`. If empty,
      this checklist doesn't apply — proceed normally.
- [ ] **Does the operation only add a nullable column with no default,
      at the end of the table, on a table *without* FULLTEXT?** That's
      the one case that's still genuinely instant. Anything else on a
      FULLTEXT table needs the rest of this checklist.
- [ ] **Measure before shipping.** Test the exact `ALTER TABLE`
      against a copy with realistic row counts (or the real table in a
      staging environment) using each algorithm to confirm what's
      actually available and how long `COPY` takes:
      ```sql
      ALTER TABLE articles ADD COLUMN _test INT NULL, ALGORITHM=INSTANT; -- expect: may fail
      ALTER TABLE articles ADD COLUMN _test INT NULL, ALGORITHM=INPLACE; -- expect: may fail
      ALTER TABLE articles ADD COLUMN _test INT NULL, ALGORITHM=COPY;    -- expect: succeeds, note the time
      ALTER TABLE articles DROP COLUMN _test;
      ```
- [ ] **If `COPY` is required, do not let it run as an unattended step
      in a routine deploy.** Schedule it during a low-traffic window,
      communicate the write-blocking duration to stakeholders in
      advance, and consider running it directly against production
      (outside the normal `php artisan migrate` deploy step) with
      someone watching, rather than trusting a CI/CD pipeline to run it
      silently.
- [ ] **Document the measured cost** in the migration's own docblock or
      the relevant `PHASE*-PROGRESS.md` entry, the way Task 9's
      correction did — so the next person doesn't have to re-discover
      this from scratch.

## Why not just avoid `FULLTEXT` entirely?

`articles.title` FULLTEXT backs the database-level text search fallback
in `ListPublicArticlesAction` (`whereFullText('title', $term)`), used
when Meilisearch is unavailable or for the non-search-engine code path.
Dropping it to avoid this DDL cost would trade a rare, plannable
migration inconvenience for a permanent search-quality regression —
not a good trade. The fix is procedure, not removing the index.

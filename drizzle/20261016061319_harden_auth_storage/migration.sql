-- Stop the old API before migrating: old code expects the raw `token` column.
-- Take the user-table lock first, preserving the application's lock order.
LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "users"
    GROUP BY lower(btrim("email"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Email normalization would merge existing accounts; resolve case/whitespace duplicates before retrying the migration'
      USING ERRCODE = '23505';
  END IF;
END $$;
--> statement-breakpoint
UPDATE "users"
SET "email" = lower(btrim("email")), "updated_at" = now()
WHERE "email" IS DISTINCT FROM lower(btrim("email"));
--> statement-breakpoint
ALTER TABLE "refresh_tokens" RENAME COLUMN "token" TO "token_hash";
--> statement-breakpoint
-- PostgreSQL's built-in sha256 requires no pgcrypto extension. Existing cookies
-- remain usable: the application hashes the same UTF-8 token for each lookup.
UPDATE "refresh_tokens"
SET "token_hash" = encode(sha256(convert_to("token_hash", 'UTF8')), 'hex');

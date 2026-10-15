ALTER TABLE "users" ADD COLUMN "password_hash" varchar(100);
--> statement-breakpoint
-- Existing users have no password to hash. Disable password login until a real
-- hash is set; this marker is not a usable password hash or an insert default.
UPDATE "users"
SET "password_hash" = '!password-reset-required'
WHERE "password_hash" IS NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;

import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./user.schema.js";

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    token: text("token").notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { precision: 3, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("refresh_tokens_user_id_index").on(table.userId),
    index("refresh_tokens_expires_at_index").on(table.expiresAt),
  ],
);

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

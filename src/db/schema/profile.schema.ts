import { integer, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { users } from "./user.schema.js";

export const profiles = pgTable("profiles", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  bio: text("bio").notNull(),
  avatar: varchar("avatar", { length: 500 }),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

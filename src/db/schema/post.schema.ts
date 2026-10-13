import { boolean, index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./user.schema.js";

export const posts = pgTable(
  "posts",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content"),
    published: boolean("published").notNull().default(false),
    views: integer("views").notNull().default(0),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 3, mode: "date" })
      .notNull()
      .defaultNow()
      // Like Prisma's @updatedAt, this runs in the ORM rather than a database trigger.
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("posts_author_id_index").on(table.authorId),
    index("posts_published_index").on(table.published),
  ],
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

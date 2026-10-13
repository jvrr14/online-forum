import { defineRelations } from "drizzle-orm";
import { categories } from "./category.schema.js";
import { postCategories } from "./post-category.schema.js";
import { posts } from "./post.schema.js";
import { profiles } from "./profile.schema.js";
import { users } from "./user.schema.js";

export const relations = defineRelations(
  { users, posts, profiles, categories, postCategories },
  (r) => ({
    users: {
      posts: r.many.posts({ from: r.users.id, to: r.posts.authorId }),
      profile: r.one.profiles({ from: r.users.id, to: r.profiles.userId, optional: true }),
    },
    profiles: {
      user: r.one.users({ from: r.profiles.userId, to: r.users.id, optional: false }),
    },
    posts: {
      author: r.one.users({ from: r.posts.authorId, to: r.users.id, optional: false }),
      categories: r.many.categories({
        from: r.posts.id.through(r.postCategories.postId),
        to: r.categories.id.through(r.postCategories.categoryId),
      }),
    },
    categories: {
      posts: r.many.posts({
        from: r.categories.id.through(r.postCategories.categoryId),
        to: r.posts.id.through(r.postCategories.postId),
      }),
    },
  }),
);

import { posts } from "../data/store.js";
import type { Post } from "../types/forum.js";

export function findAllPosts(): Post[] {
  return posts;
}

export function findPostById(id: number): Post | undefined {
  return posts.find((post) => post.id === id);
}

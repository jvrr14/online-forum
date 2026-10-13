import type { Post, User } from "../types/forum.js";

// Temporary process-local storage. Changes are lost when the server restarts.
export const users: User[] = [
  { id: 1, username: "jon", email: "jon@example.com" },
  { id: 2, username: "dave", email: "dave@example.com" },
  { id: 3, username: "lin", email: "lin@example.com" },
];

export const posts: Post[] = [
  { id: 1, title: "First Post", content: "Hello world", published: true, authorId: 1 },
  { id: 2, title: "Draft Post", content: "Work in progress", published: false, authorId: 1 },
  { id: 3, title: "Another Post", content: "Some content here", published: true, authorId: 2 },
];

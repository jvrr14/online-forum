import { users } from "../data/store.js";
import type { User } from "../types/forum.js";

export function findAllUsers(): User[] {
  return users;
}

export function findUserById(id: number): User | undefined {
  return users.find((user) => user.id === id);
}

export function createUser(input: Pick<User, "username" | "email">): User {
  const id = users.reduce((maxId, user) => Math.max(maxId, user.id), 0) + 1;
  const user: User = { id, username: input.username, email: input.email };
  users.push(user);
  return user;
}

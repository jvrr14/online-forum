import { users, type User } from "../schema/user.schema.js";

type PublicUserFieldSelection = Partial<{
  [Key in Exclude<keyof User, "passwordHash">]: (typeof users)[Key];
}>;

// Allowlist public fields so new database columns stay private by default.
export const publicUserFields = {
  id: users.id,
  username: users.username,
  email: users.email,
  role: users.role,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
} as const satisfies PublicUserFieldSelection;

export const postAuthorFields = {
  id: publicUserFields.id,
  username: publicUserFields.username,
} as const satisfies PublicUserFieldSelection;

export const postAuthorWithEmailFields = {
  ...postAuthorFields,
  email: publicUserFields.email,
} as const satisfies PublicUserFieldSelection;

// Derive relational-query selections from the same allowlists as SQL queries.
function relationalColumns<Fields extends Record<string, unknown>>(fields: Fields) {
  return Object.fromEntries(Object.keys(fields).map((key) => [key, true])) as {
    [Key in keyof Fields]: true;
  };
}

export const publicUserColumns = relationalColumns(publicUserFields);
export const postAuthorColumns = relationalColumns(postAuthorFields);
export const postAuthorWithEmailColumns = relationalColumns(postAuthorWithEmailFields);

export type PublicUser = Pick<User, keyof typeof publicUserFields>;
export type PostAuthor = Pick<PublicUser, keyof typeof postAuthorFields>;
export type PostAuthorWithEmail = Pick<PublicUser, keyof typeof postAuthorWithEmailFields>;

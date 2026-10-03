import type { Generation, User } from "@/types";

// Placeholders until authentication exists; templates, categories and packages
// now come from Postgres (see src/lib/queries.ts).

export const mockUser: User = { id: "USR_829381", name: "Guest Preview", credits: 35 };

export const mockHistory: Generation[] = [];

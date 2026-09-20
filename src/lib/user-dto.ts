import type { User } from "@/lib/types";

export function publicUserDto(row: {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  onboardingDone?: boolean;
}): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role === "admin" ? "admin" : "client",
    createdAt: row.createdAt.toISOString(),
    onboardingDone: Boolean(row.onboardingDone),
  };
}

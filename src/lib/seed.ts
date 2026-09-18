// Idempotent admin seed: creates an admin user from env vars on first need.
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function ensureAdminSeed(): Promise<void> {
  try {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) return;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return;

    await db.user.create({
      data: {
        email,
        name: "Администратор",
        passwordHash: await hashPassword(password),
        role: "admin",
      },
    });
    console.log(`[seed] admin user created: ${email}`);
  } catch (err) {
    console.error("[seed] failed to ensure admin seed:", err);
  }
}

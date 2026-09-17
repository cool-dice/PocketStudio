// Single Prisma client & schema: reuse the main app's client.
// Dependencies (@prisma/client) resolve from /home/z/my-project/node_modules
// (module resolution walks up under bun; this service has no node_modules).

import { db } from "../../src/lib/db";

export { db };

# Legacy sandbox packagers

These scripts are leftover **z-ai / SQLite preview packagers** from the original
sandbox environment (`/home/z/my-project`, `file:./db/custom.db`). They are **not**
how PocketStudio runs.

Product start is documented in the repo root README: PostgreSQL + pgvector,
`bun run db:push`, `bun run dev`. Nothing in `package.json` invokes this folder.

Keep the files only so the historical sandbox build (`build.sh`,
`database-runtime-build.sh`, mini-service wrappers) still exists for that
environment. Do not document them as the product runtime.

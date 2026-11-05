import "dotenv/config"

import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // A harmless fallback lets `prisma generate` run during image builds.
    // Migrations and the application still require a real runtime URL.
    url:
      process.env.DATABASE_URL ??
      "postgresql://suos:suos@127.0.0.1:5432/suos",
  },
})

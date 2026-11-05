import type { ReactNode } from "react"
import { connection } from "next/server"

import { requireAdmin } from "@/lib/server/dal/auth"

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await connection()
  await requireAdmin()

  return children
}

import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { isStaffRole } from "@/lib/roles"
import { getCurrentUser } from "@/lib/server/dal/auth"

import { AdminLoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Sign in | Pubesto Admin",
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>
}) {
  const [user, { denied }] = await Promise.all([getCurrentUser(), searchParams])
  if (user && isStaffRole(user.role)) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.png" alt="" className="size-10 rounded-lg" />
          <h1 className="text-xl font-semibold">Pubesto Admin</h1>
          <p className="text-sm text-muted-foreground">Sign in with your staff account.</p>
        </div>
        {user && !isStaffRole(user.role) ? (
          <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {user.email} is a customer account. Sign in with a staff account to open the dashboard.
          </p>
        ) : null}
        {denied ? (
          <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Administrator access is required.
          </p>
        ) : null}
        <AdminLoginForm />
      </div>
    </main>
  )
}

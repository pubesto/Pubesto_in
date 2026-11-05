"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Pencil, Plus, ShieldCheck, Trash2, UserRoundCog } from "lucide-react"
import { toast } from "sonner"

import {
  createStaffAction,
  removeStaffAction,
  updateStaffAction,
} from "@/app/actions/staff"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PERMISSION_MODULES, type PermissionKey } from "@/lib/permissions"
import type { StaffMember } from "@/lib/server/dal/staff"

type StaffRole = "ADMIN" | "SUB_ADMIN"

type EditorState = {
  mode: "create" | "edit"
  userId?: string
  name: string
  email: string
  password: string
  role: StaffRole
  permissions: Set<PermissionKey>
}

const emptyEditor: EditorState = {
  mode: "create",
  name: "",
  email: "",
  password: "",
  role: "SUB_ADMIN",
  permissions: new Set(),
}

function summarisePermissions(member: StaffMember) {
  if (member.role === "ADMIN") return "Full access to everything"
  if (!member.permissions.length) return "No permissions yet"

  return PERMISSION_MODULES.flatMap((module) => {
    const levels = module.permissions
      .filter((permission) => member.permissions.includes(permission.key))
      .map((permission) => permission.label.toLowerCase())
    return levels.length ? [`${module.label}: ${levels.join(", ")}`] : []
  }).join(" · ")
}

function formatDate(value: string | null) {
  if (!value) return "Never"
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function StaffManager({ initialStaff }: { initialStaff: StaffMember[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [removing, setRemoving] = useState<StaffMember | null>(null)

  const admins = useMemo(() => initialStaff.filter((member) => member.role === "ADMIN"), [initialStaff])
  const subAdmins = useMemo(
    () => initialStaff.filter((member) => member.role === "SUB_ADMIN"),
    [initialStaff],
  )

  function openCreate() {
    setEditor({ ...emptyEditor, permissions: new Set() })
  }

  function openEdit(member: StaffMember) {
    setEditor({
      mode: "edit",
      userId: member.id,
      name: member.name,
      email: member.email,
      password: "",
      role: member.role,
      permissions: new Set(member.permissions),
    })
  }

  function togglePermission(key: PermissionKey, checked: boolean) {
    setEditor((current) => {
      if (!current) return current
      const next = new Set(current.permissions)
      if (checked) next.add(key)
      else next.delete(key)
      return { ...current, permissions: next }
    })
  }

  function toggleModule(moduleKey: string, checked: boolean) {
    const definition = PERMISSION_MODULES.find((entry) => entry.key === moduleKey)
    if (!definition) return
    setEditor((current) => {
      if (!current) return current
      const next = new Set(current.permissions)
      for (const permission of definition.permissions) {
        if (checked) next.add(permission.key)
        else next.delete(permission.key)
      }
      return { ...current, permissions: next }
    })
  }

  function submitEditor() {
    if (!editor) return
    const permissions = [...editor.permissions]

    startTransition(async () => {
      if (editor.mode === "create") {
        const result = await createStaffAction({
          name: editor.name,
          email: editor.email,
          password: editor.password,
          role: editor.role,
          permissions,
        })
        if (!result.success) {
          toast.error(result.message)
          return
        }
        if (result.created) {
          toast.success(
            result.invited
              ? "Account created. A set-your-password email has been sent."
              : "Account created with the temporary password you entered.",
          )
        } else {
          toast.success("Existing account promoted to staff.")
        }
      } else {
        const result = await updateStaffAction({
          userId: editor.userId,
          role: editor.role,
          permissions,
        })
        if (!result.success) {
          toast.error(result.message)
          return
        }
        toast.success("Permissions updated.")
      }

      setEditor(null)
      router.refresh()
    })
  }

  function confirmRemove() {
    if (!removing) return
    const member = removing
    startTransition(async () => {
      const result = await removeStaffAction({ userId: member.id })
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(`${member.name} no longer has dashboard access.`)
      setRemoving(null)
      router.refresh()
    })
  }

  const createDisabled =
    isPending ||
    !editor ||
    (editor.mode === "create" && (editor.name.trim().length < 2 || !editor.email.includes("@")))

  return (
    <main className="min-h-full flex-1 bg-[#f5f5f5] p-4 text-black sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="size-4" />
            Staff &amp; permissions
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-black/60">
            Full administrators can do everything. Sub-admins only see and use the
            modules you tick for them; every action is checked on the server too.
          </p>
        </div>
        <Button onClick={openCreate} className="h-8 rounded-lg px-3 text-xs">
          <Plus className="size-3.5" />
          Add staff member
        </Button>
      </div>

      <section className="mt-5 rounded-xl border border-black/10 bg-white shadow-sm">
        <header className="border-b border-black/10 px-4 py-3">
          <h2 className="text-sm font-medium">Administrators</h2>
          <p className="text-xs text-black/55">Unrestricted access, including this page.</p>
        </header>
        <StaffTable
          members={admins}
          onEdit={openEdit}
          onRemove={setRemoving}
          emptyLabel="No administrators found."
        />
      </section>

      <section className="mt-5 rounded-xl border border-black/10 bg-white shadow-sm">
        <header className="border-b border-black/10 px-4 py-3">
          <h2 className="text-sm font-medium">Sub-admins</h2>
          <p className="text-xs text-black/55">Each sub-admin has their own set of permissions.</p>
        </header>
        <StaffTable
          members={subAdmins}
          onEdit={openEdit}
          onRemove={setRemoving}
          emptyLabel="No sub-admins yet. Add one to delegate part of the dashboard."
        />
      </section>

      <Dialog open={editor !== null} onOpenChange={(open) => (!open && !isPending ? setEditor(null) : null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editor?.mode === "create" ? "Add staff member" : `Edit ${editor?.name ?? "staff member"}`}
            </DialogTitle>
            <DialogDescription>
              {editor?.mode === "create"
                ? "Use an existing customer email to promote that account, or a new email to create one."
                : "Change the role or adjust which modules this person can use."}
            </DialogDescription>
          </DialogHeader>

          {editor ? (
            <div className="space-y-5">
              {editor.mode === "create" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="staff-name">Name</Label>
                    <Input
                      id="staff-name"
                      value={editor.name}
                      onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                      placeholder="Priya Sharma"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="staff-email">Email</Label>
                    <Input
                      id="staff-email"
                      type="email"
                      value={editor.email}
                      onChange={(event) => setEditor({ ...editor, email: event.target.value })}
                      placeholder="priya@pubesto.com"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="staff-password">Temporary password (optional)</Label>
                    <Input
                      id="staff-password"
                      type="text"
                      autoComplete="off"
                      value={editor.password}
                      onChange={(event) => setEditor({ ...editor, password: event.target.value })}
                      placeholder="Leave empty to email a set-password link"
                    />
                    <p className="text-xs text-black/55">
                      Ignored when the email already belongs to an account. At least 8 characters.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-black/60">{editor.email}</p>
              )}

              <div className="space-y-1.5">
                <Label>Role</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <RoleOption
                    selected={editor.role === "SUB_ADMIN"}
                    title="Sub-admin"
                    description="Only the modules ticked below."
                    onSelect={() => setEditor({ ...editor, role: "SUB_ADMIN" })}
                  />
                  <RoleOption
                    selected={editor.role === "ADMIN"}
                    title="Administrator"
                    description="Everything, including staff management."
                    onSelect={() => setEditor({ ...editor, role: "ADMIN" })}
                  />
                </div>
              </div>

              {editor.role === "SUB_ADMIN" ? (
                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <div className="divide-y divide-black/10 rounded-lg border border-black/10">
                    {PERMISSION_MODULES.map((module) => {
                      const allChecked = module.permissions.every((permission) =>
                        editor.permissions.has(permission.key),
                      )
                      const someChecked = module.permissions.some((permission) =>
                        editor.permissions.has(permission.key),
                      )
                      return (
                        <div key={module.key} className="grid gap-2 px-3 py-3 sm:grid-cols-[180px_1fr]">
                          <label className="flex items-start gap-2 text-sm font-medium">
                            <Checkbox
                              checked={allChecked ? true : someChecked ? "indeterminate" : false}
                              onCheckedChange={(checked) => toggleModule(module.key, checked === true)}
                              aria-label={`All ${module.label} permissions`}
                              className="mt-0.5"
                            />
                            <span>
                              {module.label}
                              <span className="block text-xs font-normal text-black/50">
                                {module.description}
                              </span>
                            </span>
                          </label>
                          <div className="flex flex-wrap gap-x-5 gap-y-2">
                            {module.permissions.map((permission) => (
                              <label
                                key={permission.key}
                                className="flex items-start gap-2 text-sm"
                                title={permission.description}
                              >
                                <Checkbox
                                  checked={editor.permissions.has(permission.key)}
                                  onCheckedChange={(checked) =>
                                    togglePermission(permission.key, checked === true)
                                  }
                                  className="mt-0.5"
                                />
                                <span>
                                  {permission.label}
                                  <span className="block max-w-[220px] text-xs text-black/50">
                                    {permission.description}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={submitEditor} disabled={createDisabled}>
              {isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {editor?.mode === "create" ? "Add staff member" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removing !== null} onOpenChange={(open) => (!open ? setRemoving(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove dashboard access?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.name} will be signed out and turned back into a customer account.
              Their orders and profile are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={isPending}>
              Remove access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

function RoleOption({
  selected,
  title,
  description,
  onSelect,
}: {
  selected: boolean
  title: string
  description: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
        selected ? "border-black bg-black text-white" : "border-black/15 bg-white hover:border-black/40"
      }`}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className={`block text-xs ${selected ? "text-white/70" : "text-black/55"}`}>
        {description}
      </span>
    </button>
  )
}

function StaffTable({
  members,
  onEdit,
  onRemove,
  emptyLabel,
}: {
  members: StaffMember[]
  onEdit: (member: StaffMember) => void
  onRemove: (member: StaffMember) => void
  emptyLabel: string
}) {
  if (!members.length) {
    return <p className="px-4 py-6 text-sm text-black/55">{emptyLabel}</p>
  }

  return (
    <ul className="divide-y divide-black/10">
      {members.map((member) => (
        <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black/5">
            <UserRoundCog className="size-4 text-black/60" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium">{member.name}</p>
              <Badge variant={member.role === "ADMIN" ? "default" : "secondary"} className="rounded-md">
                {member.role === "ADMIN" ? "Administrator" : "Sub-admin"}
              </Badge>
              {member.isCurrentUser ? (
                <span className="text-xs text-black/45">(you)</span>
              ) : null}
            </div>
            <p className="truncate text-xs text-black/55">{member.email}</p>
            <p className="mt-1 text-xs text-black/70">{summarisePermissions(member)}</p>
            <p className="mt-0.5 text-[11px] text-black/45">
              Added {formatDate(member.createdAt)} · Last active {formatDate(member.lastActiveAt)}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-xs"
              onClick={() => onEdit(member)}
              disabled={member.isCurrentUser}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-xs text-red-600 hover:text-red-700"
              onClick={() => onRemove(member)}
              disabled={member.isCurrentUser}
            >
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

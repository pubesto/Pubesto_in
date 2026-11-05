import { z } from "zod"

import { isPermissionKey } from "@/lib/permissions"

export const staffRoleSchema = z.enum(["ADMIN", "SUB_ADMIN"])

const permissionsSchema = z
  .array(z.string().trim())
  .max(100)
  .transform((values) => [...new Set(values.filter(isPermissionKey))])

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2, "Enter the staff member's name.").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(254),
  password: z
    .string()
    .max(128, "Passwords can be at most 128 characters.")
    .optional()
    .transform((value) => (value && value.length ? value : undefined))
    .refine((value) => value === undefined || value.length >= 8, {
      message: "Temporary passwords need at least 8 characters.",
    }),
  role: staffRoleSchema.default("SUB_ADMIN"),
  permissions: permissionsSchema.default([]),
})

export const staffUpdateSchema = z.object({
  userId: z.string().trim().min(1),
  role: staffRoleSchema,
  permissions: permissionsSchema.default([]),
})

export const staffIdSchema = z.object({
  userId: z.string().trim().min(1),
})

export type StaffCreateInput = z.infer<typeof staffCreateSchema>
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>

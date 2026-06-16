/**
 * Centralized Zod validation schemas for all forms
 */

import { z } from "zod";

// ============ TRANSACTION SCHEMAS ============

export const transactionSchema = z.object({
  txn_date: z.string().min(1, "Date is required"),
  details: z.string().min(1, "Details are required"),
  debit: z.union([z.string(), z.number()]).optional().default(""),
  credit: z.union([z.string(), z.number()]).optional().default(""),
  notes: z.string().optional().default(""),
}).refine(
  (data) => {
    const debit = Number(data.debit || 0);
    const credit = Number(data.credit || 0);
    return debit > 0 || credit > 0;
  },
  { message: "Enter debit or credit amount", path: ["debit"] }
).refine(
  (data) => {
    const debit = Number(data.debit || 0);
    const credit = Number(data.credit || 0);
    return !(debit > 0 && credit > 0);
  },
  { message: "Enter either debit or credit, not both", path: ["debit"] }
);

export type TransactionFormData = z.infer<typeof transactionSchema>;

// ============ ACCOUNT SCHEMAS ============

export const accountSchema = z.object({
  name: z.string().min(1, "Account name is required").min(2, "Name must be at least 2 characters"),
  mobile: z.string().optional().refine(
    (val) => !val || /^\d{10,}$/.test(val.replace(/\D/g, "")),
    "Mobile number must have at least 10 digits"
  ),
  address: z.string().optional(),
  account_type: z.string().min(1, "Account type is required"),
  currency: z.string().min(1, "Currency is required"),
  branch_id: z.string().optional(),
});

export type AccountFormData = z.infer<typeof accountSchema>;

// ============ EXPENSE SCHEMAS ============

export const expenseSchema = z.object({
  exp_date: z.string().min(1, "Date is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  amount: z.union([z.string(), z.number()])
    .refine(
      (val) => Number(val) > 0,
      "Amount must be greater than 0"
    ),
  notes: z.string().optional().default(""),
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;

// ============ USER SCHEMAS ============

export const userCreateSchema = z.object({
  username: z.string().min(1, "Username is required").min(3, "Username must be at least 3 characters"),
  password: z.string().min(1, "Password is required").min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(1, "Full name is required"),
  newRole: z.string().min(1, "Role is required"),
  branchId: z.string().optional(),
});

export type UserCreateFormData = z.infer<typeof userCreateSchema>;

export const userEditSchema = z.object({
  eName: z.string().min(1, "Full name is required"),
  eRole: z.string().min(1, "Role is required"),
  eBranch: z.string().optional(),
  ePassword: z.string().optional().refine(
    (val) => !val || val.length >= 6,
    "Password must be at least 6 characters if provided"
  ),
});

export type UserEditFormData = z.infer<typeof userEditSchema>;

// ============ SETTINGS SCHEMAS ============

export const profileSettingsSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
});

export type ProfileSettingsFormData = z.infer<typeof profileSettingsSchema>;

export const businessSettingsSchema = z.object({
  businessName: z.string().optional(),
  businessPhone: z.string().optional(),
  businessAddress: z.string().optional(),
});

export type BusinessSettingsFormData = z.infer<typeof businessSettingsSchema>;

export const securitySettingsSchema = z.object({
  pass: z.string().min(1, "Current password is required"),
  confirmPass: z.string().min(1, "New password is required").min(6, "Password must be at least 6 characters"),
}).refine(
  (data) => data.pass !== data.confirmPass,
  { message: "New password must be different from current password", path: ["confirmPass"] }
);

export type SecuritySettingsFormData = z.infer<typeof securitySettingsSchema>;

// ============ BRANCH SCHEMAS ============

export const branchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  manager_id: z.string().optional(),
});

export type BranchFormData = z.infer<typeof branchSchema>;

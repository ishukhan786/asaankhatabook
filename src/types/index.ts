/**
 * Centralized type definitions for the application
 */

/**
 * Account type
 */
export type Account = {
  id?: string;
  account_no?: string;
  name?: string;
  mobile?: string | null;
  currency?: string | null;
  branches?: { name?: string } | null;
  address?: string | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * Transaction type
 */
export type Transaction = {
  id?: string;
  txn_date?: string | null;
  details?: string | null;
  notes?: string | null;
  debit?: number | string | null;
  credit?: number | string | null;
  balance?: number | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * Transaction with calculated balance (used in lists)
 */
export type TransactionWithBalance = Transaction & {
  balance: number;
};

/**
 * User role type
 */
export type UserRole =
  | "admin"
  | "branch_manager"
  | "accountant"
  | "cashier"
  | "viewer";

/**
 * User profile type
 */
export type UserProfile = {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  branch_id?: string;
  created_at: string;
  updated_at: string;
};

/**
 * Pagination params
 */
export type PaginationParams = {
  page: number;
  limit: number;
  offset: number;
};

/**
 * API Response wrapper
 */
export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
};

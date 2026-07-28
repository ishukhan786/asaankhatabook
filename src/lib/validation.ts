/**
 * Validation utilities for transactions and forms
 */

export type ValidationError = {
  field?: string;
  message: string;
};

/**
 * Validates transaction debit/credit amounts
 * @param debit - Debit amount
 * @param credit - Credit amount
 * @returns ValidationError or null if valid
 */
export const validateDebitCredit = (
  debit: string | number,
  credit: string | number
): ValidationError | null => {
  const debitNum = Number(debit || 0);
  const creditNum = Number(credit || 0);

  if (debitNum < 0.01 && creditNum < 0.01) {
    return { message: "Enter a valid debit or credit amount (minimum 0.01)" };
  }

  if (debitNum > 0 && creditNum > 0) {
    return { message: "Enter either debit or credit, not both" };
  }

  return null;
};

/**
 * Validates transaction date
 * @param date - Date string in YYYY-MM-DD format
 * @returns ValidationError or null if valid
 */
export const validateDate = (date: string): ValidationError | null => {
  if (!date || !date.trim()) {
    return { field: "date", message: "Date is required" };
  }

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return { field: "date", message: "Invalid date format" };
  }

  return null;
};

/**
 * Validates transaction details/narration
 * @param details - Transaction details string
 * @returns ValidationError or null if valid
 */
export const validateDetails = (details: string): ValidationError | null => {
  if (!details || !details.trim()) {
    return { field: "details", message: "Details are required" };
  }

  return null;
};

/**
 * Validates complete transaction
 * @param date - Transaction date
 * @param details - Transaction details
 * @param debit - Debit amount
 * @param credit - Credit amount
 * @returns ValidationError or null if valid
 */
export const validateTransaction = (
  date: string,
  details: string,
  debit: string | number,
  credit: string | number
): ValidationError | null => {
  const dateError = validateDate(date);
  if (dateError) return dateError;

  const detailsError = validateDetails(details);
  if (detailsError) return detailsError;

  const amountError = validateDebitCredit(debit, credit);
  if (amountError) return amountError;

  return null;
};

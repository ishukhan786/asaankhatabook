/**
 * Error handling utilities for consistent error management
 */

import { logger } from "./logger";
import { toast } from "sonner";

export type ErrorType =
  | "network"
  | "auth"
  | "validation"
  | "notfound"
  | "permission"
  | "database"
  | "unknown";

export type AppError = {
  type: ErrorType;
  message: string;
  originalError?: unknown;
  context?: Record<string, unknown>;
};

/**
 * Extracts error message from various error types
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if (obj.message && typeof obj.message === "string") {
      return obj.message;
    }
  }

  return "An unexpected error occurred";
};

/**
 * Categorizes error types for better error handling
 */
export const categorizeError = (error: unknown): ErrorType => {
  const message = getErrorMessage(error);

  if (
    message.toLowerCase().includes("network") ||
    message.toLowerCase().includes("fetch")
  ) {
    return "network";
  }

  if (
    message.toLowerCase().includes("unauthorized") ||
    message.toLowerCase().includes("authentication")
  ) {
    return "auth";
  }

  if (
    message.toLowerCase().includes("forbidden") ||
    message.toLowerCase().includes("permission")
  ) {
    return "permission";
  }

  if (
    message.toLowerCase().includes("not found") ||
    message.toLowerCase().includes("404")
  ) {
    return "notfound";
  }

  if (
    message.toLowerCase().includes("validation") ||
    message.toLowerCase().includes("invalid")
  ) {
    return "validation";
  }

  if (
    message.toLowerCase().includes("database") ||
    message.toLowerCase().includes("relation")
  ) {
    return "database";
  }

  return "unknown";
};

/**
 * Handles Supabase errors with logging and user feedback
 * @param error - The error to handle
 * @param context - Optional context for better error tracking
 * @param userMessage - Custom user-facing message (optional)
 */
export const handleSupabaseError = (
  error: unknown,
  context?: { operation: string; table?: string; userId?: string },
  userMessage?: string
): string => {
  const errorType = categorizeError(error);
  const message = userMessage || getErrorMessage(error);

  // Log error with context for debugging/monitoring
  logger.error(`[${errorType.toUpperCase()}]`, {
    message,
    context,
    originalError: error instanceof Error ? error.stack : error,
  });

  // Show toast notification to user
  const displayMessage = userMessage || message;
  toast.error(displayMessage);

  return displayMessage;
};

/**
 * Handles form submission errors
 * @param error - The error to handle
 * @param operationName - Name of the operation (e.g., "Save Transaction")
 */
export const handleFormError = (
  error: unknown,
  operationName: string = "Operation"
): string => {
  const message = getErrorMessage(error);

  logger.error(`Form error - ${operationName}`, {
    message,
    error: error instanceof Error ? error.stack : error,
  });

  toast.error(`Failed to ${operationName.toLowerCase()}: ${message}`);

  return message;
};

/**
 * Safe Supabase API wrapper
 * Handles errors and provides consistent error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: { operation: string; table?: string }
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await operation();
    return { data, error: null };
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    logger.error(`Error in ${context.operation}`, {
      message: errorMessage,
      context,
      error: err instanceof Error ? err.stack : err,
    });
    return { data: null, error: errorMessage };
  }
}

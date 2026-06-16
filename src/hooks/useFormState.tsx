/**
 * Custom hook for managing form state with react-hook-form
 * Simplifies form handling and error management
 */

import { useForm, UseFormProps, FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ZodSchema } from "zod";
import { useState } from "react";
import { handleFormError } from "@/lib/errors";

export interface UseFormStateOptions<T extends FieldValues> extends Omit<UseFormProps<T>, "resolver"> {
  schema: ZodSchema;
  onSuccess?: (data: T) => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
}

/**
 * Enhanced useForm hook with built-in error handling and submission logic
 * @param options - Form options including Zod schema
 * @returns Form instance with integrated error handling
 */
export function useFormState<T extends FieldValues>(
  options: UseFormStateOptions<T>
) {
  const { schema, onSuccess, onError, ...formOptions } = options;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<T>({
    ...formOptions,
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    setIsSubmitting(true);
    try {
      await onSuccess?.(data);
    } catch (error) {
      await onError?.(error);
    } finally {
      setIsSubmitting(false);
    }
  });

  return {
    ...form,
    handleSubmit,
    isSubmitting,
  };
}

/**
 * Hook for managing edit form dialog state
 * Combines form state with dialog open/close logic
 */
export function useEditFormDialog<T extends FieldValues>(
  options: UseFormStateOptions<T>
) {
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const form = useFormState(options);

  const openDialog = (item?: any) => {
    setEditingItem(item);
    if (item && options.defaultValues) {
      const values: Record<string, unknown> = {};
      for (const [key, defaultVal] of Object.entries(options.defaultValues)) {
        const raw = item[key] ?? defaultVal;
        values[key] = typeof defaultVal === "string" && raw != null ? String(raw) : raw;
      }
      form.reset(values as T);
    } else if (item) {
      form.reset(item);
    } else {
      form.reset();
    }
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingItem(null);
    form.reset();
  };

  return {
    open,
    setOpen,
    editingItem,
    openDialog,
    closeDialog,
    form,
  };
}

/**
 * Hook for managing delete confirmation dialog
 */
export function useDeleteDialog() {
  const [open, setOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openDialog = (item: any) => {
    setItemToDelete(item);
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setItemToDelete(null);
  };

  const confirmDelete = async (onDelete: () => Promise<void>) => {
    setIsDeleting(true);
    try {
      await onDelete();
      closeDialog();
    } catch (error) {
      handleFormError(error, "Delete item");
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    open,
    setOpen,
    itemToDelete,
    isDeleting,
    openDialog,
    closeDialog,
    confirmDelete,
  };
}

import { useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Hook that wraps a delete operation with an undo toast.
 * Captures the item before deletion and shows a toast with an "Undo" button.
 * If undone within 5 seconds, the item is restored.
 */
export function useUndoDelete<T extends { id: string }>(
  deleteItem: (id: string) => Promise<void>,
  restoreItem: (item: T) => Promise<T>,
  entityName: string,
): (item: T, label?: string) => Promise<void> {
  return useCallback(
    async (item: T, label?: string) => {
      const capturedItem = { ...item };
      await deleteItem(item.id);

      toast(label ?? `${entityName} deleted`, {
        action: {
          label: 'Undo',
          onClick: () => {
            restoreItem(capturedItem);
          },
        },
        duration: 5000,
      });
    },
    [deleteItem, restoreItem, entityName],
  );
}

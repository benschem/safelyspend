import { useCallback, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PaymentMethod } from '@/lib/db';
import { generateId } from '@/lib/utils';

const DEFAULT_PAYMENT_METHODS = [
  'Purchase',
  'BPAY',
  'Direct Debit',
  'Direct Credit',
  'Osko',
  'Cash',
  'Card',
];

export function usePaymentMethods() {
  const paymentMethodRecords = useLiveQuery(
    () => db.paymentMethods.toArray(),
    [],
  );

  const isLoading = paymentMethodRecords === undefined;

  // Initialize default payment methods if table is empty (outside of query)
  useEffect(() => {
    if (paymentMethodRecords !== undefined && paymentMethodRecords.length === 0) {
      const defaultRecords: PaymentMethod[] = DEFAULT_PAYMENT_METHODS.map((name, index) => ({
        id: `pm_default_${index}`,
        name,
      }));
      db.paymentMethods.bulkPut(defaultRecords);
    }
  }, [paymentMethodRecords]);

  // Extract just the names for compatibility with existing code
  const paymentMethods = useMemo(
    () => (paymentMethodRecords ?? []).map((pm) => pm.name),
    [paymentMethodRecords],
  );

  const addPaymentMethod = useCallback(
    async (method: string): Promise<string> => {
      const trimmed = method.trim();
      if (!trimmed) return '';

      // Check if exists (case-insensitive)
      const existing = (paymentMethodRecords ?? []).find(
        (m) => m.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) return existing.name;

      // Add new method
      const newRecord: PaymentMethod = {
        id: generateId(),
        name: trimmed,
      };
      await db.paymentMethods.add(newRecord);
      return trimmed;
    },
    [paymentMethodRecords],
  );

  const getOrCreate = useCallback(
    async (method: string): Promise<string> => {
      const trimmed = method.trim();
      if (!trimmed) return '';

      // Check if exists (case-insensitive)
      const existing = (paymentMethodRecords ?? []).find(
        (m) => m.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) return existing.name;

      // Add new method
      const newRecord: PaymentMethod = {
        id: generateId(),
        name: trimmed,
      };
      await db.paymentMethods.add(newRecord);
      return trimmed;
    },
    [paymentMethodRecords],
  );

  // Bulk add for import (returns map of input -> stored name)
  const bulkGetOrCreate = useCallback(
    async (methods: string[]): Promise<Map<string, string>> => {
      const result = new Map<string, string>();
      const newRecords: PaymentMethod[] = [];
      const existingRecords = paymentMethodRecords ?? [];

      for (const method of methods) {
        const trimmed = method.trim();
        if (!trimmed) continue;

        // Check existing
        const existing = existingRecords.find(
          (m) => m.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (existing) {
          result.set(trimmed, existing.name);
        } else {
          // Check if we're already adding it in this batch
          const inBatch = newRecords.find(
            (m) => m.name.toLowerCase() === trimmed.toLowerCase(),
          );
          if (inBatch) {
            result.set(trimmed, inBatch.name);
          } else {
            const newRecord: PaymentMethod = {
              id: generateId(),
              name: trimmed,
            };
            newRecords.push(newRecord);
            result.set(trimmed, trimmed);
          }
        }
      }

      if (newRecords.length > 0) {
        await db.paymentMethods.bulkAdd(newRecords);
      }

      return result;
    },
    [paymentMethodRecords],
  );

  return {
    paymentMethods,
    isLoading,
    addPaymentMethod,
    getOrCreate,
    bulkGetOrCreate,
  };
}

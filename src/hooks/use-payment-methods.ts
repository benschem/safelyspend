import { useLocalStorage } from './use-local-storage';

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
  const [paymentMethods, setPaymentMethods] = useLocalStorage<string[]>(
    'budget:paymentMethods',
    DEFAULT_PAYMENT_METHODS,
  );

  const addPaymentMethod = (method: string): string => {
    const trimmed = method.trim();
    if (!trimmed) return '';

    // Check if exists (case-insensitive)
    const existing = paymentMethods.find(
      (m) => m.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing;

    // Add new method
    setPaymentMethods([...paymentMethods, trimmed]);
    return trimmed;
  };

  const getOrCreate = (method: string): string => {
    const trimmed = method.trim();
    if (!trimmed) return '';

    // Check if exists (case-insensitive)
    const existing = paymentMethods.find(
      (m) => m.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing;

    // Add new method
    setPaymentMethods((prev) => [...prev, trimmed]);
    return trimmed;
  };

  // Bulk add for import (returns map of input -> stored name)
  const bulkGetOrCreate = (methods: string[]): Map<string, string> => {
    const result = new Map<string, string>();
    const newMethods: string[] = [];

    for (const method of methods) {
      const trimmed = method.trim();
      if (!trimmed) continue;

      // Check existing
      const existing = paymentMethods.find(
        (m) => m.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) {
        result.set(trimmed, existing);
      } else {
        // Check if we're already adding it in this batch
        const inBatch = newMethods.find(
          (m) => m.toLowerCase() === trimmed.toLowerCase(),
        );
        if (inBatch) {
          result.set(trimmed, inBatch);
        } else {
          newMethods.push(trimmed);
          result.set(trimmed, trimmed);
        }
      }
    }

    if (newMethods.length > 0) {
      setPaymentMethods((prev) => [...prev, ...newMethods]);
    }

    return result;
  };

  return {
    paymentMethods,
    addPaymentMethod,
    getOrCreate,
    bulkGetOrCreate,
  };
}

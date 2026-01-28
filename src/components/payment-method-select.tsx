import { useMemo, useCallback } from 'react';
import { CreatableSelect } from './creatable-select';
import { usePaymentMethods } from '@/hooks/use-payment-methods';

interface PaymentMethodSelectProps {
  value: string;
  onChange: (value: string) => void;
  allowNone?: boolean;
  disabled?: boolean;
}

export function PaymentMethodSelect({
  value,
  onChange,
  allowNone = true,
  disabled = false,
}: PaymentMethodSelectProps) {
  const { paymentMethods, addPaymentMethod } = usePaymentMethods();

  const options = useMemo(
    () =>
      paymentMethods
        .map((method) => ({
          value: method,
          label: method,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [paymentMethods],
  );

  const handleCreateNew = useCallback(
    (name: string) => {
      return addPaymentMethod(name);
    },
    [addPaymentMethod],
  );

  return (
    <CreatableSelect
      options={options}
      value={value}
      onChange={onChange}
      onCreateNew={handleCreateNew}
      placeholder="Select payment method"
      allowNone={allowNone}
      noneLabel="None"
      createLabel="Add payment method"
      disabled={disabled}
    />
  );
}

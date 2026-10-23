import React from 'react';

import { ChevronDownIcon } from '@/components/ui/lucide-icons';
import { Select, SelectBackdrop, SelectContent, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';
import { type UdfOption } from '@/lib/udf/options';

// The select has no item for an empty value, so "nothing picked" travels as this and is sent as ''.
const NO_VALUE = '__none__';

interface UdfSelectProps {
  options: UdfOption[];
  /** The stored option key; '' when nothing is picked. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  isDark?: boolean;
  placeholder: string;
  label: string;
  testID?: string;
}

/** A dropdown custom field: shows each option's label and stores its key. */
export const UdfSelect: React.FC<UdfSelectProps> = ({ options, value, onChange, disabled = false, placeholder, label, testID }) => {
  // A stored value no longer in the list (an option since removed) still shows, so saving does not silently drop it.
  const isUnlisted = value !== '' && !options.some((o) => o.key === value);
  const selectedLabel = options.find((o) => o.key === value)?.label ?? value;

  return (
    <Select selectedValue={value || NO_VALUE} onValueChange={(next) => onChange(next === NO_VALUE ? '' : next)} isDisabled={disabled}>
      <SelectTrigger testID={testID} accessibilityLabel={label}>
        {/* Shown from the value, not the select's own label state, so a value loaded after mount displays too. */}
        <SelectInput placeholder={placeholder} value={selectedLabel} className="flex-1" />
        <SelectIcon as={ChevronDownIcon} className="mr-3" />
      </SelectTrigger>
      <SelectPortal>
        <SelectBackdrop />
        <SelectContent>
          <SelectItem label={placeholder} value={NO_VALUE} />
          {isUnlisted ? <SelectItem label={value} value={value} /> : null}
          {options.map((option) => (
            <SelectItem key={option.key} label={option.label} value={option.key} />
          ))}
        </SelectContent>
      </SelectPortal>
    </Select>
  );
};

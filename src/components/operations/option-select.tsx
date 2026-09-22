import React from 'react';

import { ChevronDownIcon } from '@/components/ui/lucide-icons';
import { Select, SelectBackdrop, SelectContent, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';

export interface SelectOption {
  value: string;
  label: string;
}

interface OptionSelectProps {
  value: string;
  options: SelectOption[];
  placeholder: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  testID?: string;
}

// gluestack's Select only knows the label of an option the person picked; pass the current one so a
// value that came from the server renders as its label instead of the placeholder.
export const OptionSelect = ({ value, options, placeholder, onChange, isDisabled, testID }: OptionSelectProps) => {
  const current = options.find((option) => option.value === value);
  return (
    <Select selectedValue={value} initialLabel={current?.label} onValueChange={onChange} isDisabled={isDisabled} testID={testID}>
      <SelectTrigger>
        <SelectInput placeholder={placeholder} className="w-5/6" />
        <SelectIcon as={ChevronDownIcon} className="mr-3" />
      </SelectTrigger>
      <SelectPortal>
        <SelectBackdrop />
        <SelectContent className="max-h-[60vh] pb-20">
          {options.map((option) => (
            <SelectItem key={option.value} label={option.label} value={option.value} />
          ))}
        </SelectContent>
      </SelectPortal>
    </Select>
  );
};

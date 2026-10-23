import React from 'react';

import { type UdfOption } from '@/lib/udf/options';

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

const baseStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  borderRadius: 8,
  borderWidth: 1,
  borderStyle: 'solid',
  cursor: 'pointer',
  outline: 'none',
};

const darkStyle: React.CSSProperties = { backgroundColor: '#262626', borderColor: '#404040', color: '#ffffff' };
const lightStyle: React.CSSProperties = { backgroundColor: '#ffffff', borderColor: '#d1d5db', color: '#111827' };
const disabledStyle: React.CSSProperties = { opacity: 0.6, cursor: 'not-allowed' };

/** A dropdown custom field: shows each option's label and stores its key. */
export const UdfSelect: React.FC<UdfSelectProps> = ({ options, value, onChange, disabled = false, isDark = false, placeholder, label, testID }) => {
  // A stored value no longer in the list (an option since removed) still shows, so saving does not silently drop it.
  const isUnlisted = value !== '' && !options.some((o) => o.key === value);

  return (
    <select
      className="web-input-accessible"
      style={{ ...baseStyle, ...(isDark ? darkStyle : lightStyle), ...(disabled ? disabledStyle : {}) }}
      value={value}
      disabled={disabled}
      aria-label={label}
      data-testid={testID}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {isUnlisted ? <option value={value}>{value}</option> : null}
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

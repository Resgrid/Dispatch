import { LockIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { isFieldRedacted } from '@/lib/data-protection/redacted';

interface ProtectedTextProps {
  /** The value as the server returned it. */
  value?: string | null;
  /** Catalog field id, e.g. ProtectedFieldIds.callName. */
  fieldId: string;
  /** The RedactedFields list from the same response. */
  redactedFields?: string[] | null;
  /** Rendered when the value is present and not redacted. Defaults to the value as plain text. */
  children?: React.ReactNode;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  testID?: string;
}

/**
 * One protected field.
 *
 * Withheld values render as a lock and a short label rather than the literal word "REDACTED" the
 * server sends. That word is a wire sentinel, not copy: shown raw it reads as data — members have
 * asked why a caller is named REDACTED — and it gives no hint that the information exists and can
 * be revealed. The lock says both.
 *
 * Everything else passes straight through, so this is safe to use on fields that are only
 * sometimes protected, and on departments that have no addon at all.
 */
export const ProtectedText: React.FC<ProtectedTextProps> = ({ value, fieldId, redactedFields, children, className, size = 'md', testID }) => {
  const { t } = useTranslation();

  if (isFieldRedacted(redactedFields, fieldId, value)) {
    return (
      <HStack space="xs" className="items-center" testID={testID ?? `protected-field-${fieldId}`}>
        <LockIcon size={size === 'xs' || size === 'sm' ? 12 : 14} />
        <Text size={size} className={`italic text-typography-500 ${className ?? ''}`}>
          {t('data_protection.protected_value', 'Protected')}
        </Text>
      </HStack>
    );
  }

  if (children) {
    return <>{children}</>;
  }

  return (
    <Text size={size} className={className} testID={testID}>
      {value}
    </Text>
  );
};

import { useColorScheme } from 'nativewind';
import React from 'react';
import { TouchableOpacity } from 'react-native';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { responseCodeChipColors } from '@/lib/run-card-conditions';

interface ResponseCodeChipProps {
  /** Short code shown on the chip ("C3"). Nothing renders without one. */
  code: string | null | undefined;
  /** Full name ("Lights and siren"), read out by screen readers. */
  name?: string | null;
  /** Badge colour from the department's catalog (hex); a plain outlined chip without one. */
  color?: string | null;
  /** Makes the chip a button (e.g. to open the code picker). */
  onPress?: () => void;
  /** Ring for the picked option in a picker. */
  isSelected?: boolean;
  testID?: string;
}

/**
 * A response code (conditional run cards) as a small coloured chip, in the department's colour for it, so a dispatcher
 * reads "C3" at a glance wherever a unit carries one: the run card proposal, the awaiting list, the call's dispatches.
 */
export const ResponseCodeChip: React.FC<ResponseCodeChipProps> = ({ code, name, color, onPress, isSelected = false, testID }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!code) {
    return null;
  }

  const colors = responseCodeChipColors(color);
  const ring = isSelected ? 'border-2 border-blue-500' : `border ${colors ? 'border-black/20' : isDark ? 'border-neutral-600' : 'border-neutral-300'}`;

  const chip = (
    <Box className={`rounded px-1.5 py-0.5 ${ring}`} style={colors ? { backgroundColor: colors.backgroundColor } : undefined} testID={testID}>
      <Text className={`text-xs font-bold ${colors ? '' : isDark ? 'text-neutral-200' : 'text-neutral-700'}`} style={colors ? { color: colors.color } : undefined}>
        {code}
      </Text>
    </Box>
  );

  if (!onPress) {
    return chip;
  }

  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={name ? `${code} ${name}` : code} testID={testID ? `${testID}-button` : undefined}>
      {chip}
    </TouchableOpacity>
  );
};

import React from 'react';
import { Platform } from 'react-native';

/**
 * Android field metrics, applied from JS because the class layer cannot express them correctly.
 *
 * Measured on device, each case a real Input/InputField:
 *   - the class `h-full` (height: 100%) resolves taller than the fixed-height parent on Android, and
 *     the parent's overflow-hidden then clips the top of the glyphs;
 *   - an explicit pixel height matching the parent renders correctly;
 *   - overriding only the lineHeight, at either the class or the style layer, does not help;
 *   - lineHeight 0 (what iOS uses) hides Android text completely, and a later `undefined` does not
 *     clear the value the size class sets.
 *
 * So Android gets a concrete height plus a lineHeight near the font size, and drops the extra font
 * padding. iOS keeps the zero lineHeight that upstream applied through `ios:leading-[0px]`; that class
 * is gone from the base style so the value can be chosen per platform here.
 */
const ANDROID_FIELD_METRICS: Record<string, { height: number; lineHeight: number }> = {
  sm: { height: 36, lineHeight: 18 },
  md: { height: 40, lineHeight: 20 },
  lg: { height: 44, lineHeight: 22 },
  xl: { height: 48, lineHeight: 25 },
};

export const useTextFieldVerticalFix = (size: string | undefined) =>
  React.useMemo(() => {
    if (Platform.OS === 'ios') {
      return { lineHeight: 0 } as const;
    }
    if (Platform.OS === 'android') {
      const metrics = ANDROID_FIELD_METRICS[size ?? 'md'] ?? ANDROID_FIELD_METRICS.md;
      return { height: metrics.height, lineHeight: metrics.lineHeight, includeFontPadding: false, textAlignVertical: 'center' } as const;
    }
    return undefined;
  }, [size]);

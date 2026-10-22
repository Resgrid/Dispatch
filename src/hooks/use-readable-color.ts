import { useColorScheme } from 'nativewind';
import { useMemo } from 'react';

import { type ColorScheme, MARK_CONTRAST, readableOnSurface, TEXT_CONTRAST } from '@/lib/readable-color';

export type ReadableColors = {
  scheme: ColorScheme;
  /** A server or department colour adjusted to read as text on the current theme's surface (4.5:1). */
  text: (color: string | null | undefined, fallback?: string) => string;
  /** The same for dots, borders and icons (3:1). */
  mark: (color: string | null | undefined, fallback?: string) => string;
};

/**
 * Theme-aware versions of department/server colours (status, staffing, priority) for the current colour scheme. See
 * lib/readable-color: the hue is kept, only the lightness moves, and only when the colour would not read.
 */
export const useReadableColor = (): ReadableColors => {
  const { colorScheme } = useColorScheme();
  const scheme: ColorScheme = colorScheme === 'dark' ? 'dark' : 'light';

  return useMemo(
    () => ({
      scheme,
      text: (color, fallback = '#6b7280') => readableOnSurface(color || fallback, scheme, TEXT_CONTRAST),
      mark: (color, fallback = '#6b7280') => readableOnSurface(color || fallback, scheme, MARK_CONTRAST),
    }),
    [scheme]
  );
};

'use client';
import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { ToastProvider } from '@gluestack-ui/core/toast/creator';
import React, { useEffect } from 'react';
import { Appearance, useColorScheme, View, type ViewProps } from 'react-native';

export type ModeType = 'light' | 'dark' | 'system';

export function GluestackUIProvider({ mode = 'light', ...props }: { mode?: ModeType; children?: React.ReactNode; style?: ViewProps['style'] }) {
  // Tokens (--color-*) flip through the prefers-color-scheme media query,
  // which react-native-css drives from Appearance. The className wrapper
  // drives the class-based `dark:` variant (see @custom-variant in global.css).
  const osScheme = useColorScheme();
  const resolvedScheme: 'light' | 'dark' = mode === 'system' ? (osScheme === 'dark' ? 'dark' : 'light') : mode;

  useEffect(() => {
    Appearance.setColorScheme(mode === 'system' ? null : mode);
  }, [mode]);

  return (
    <View className={resolvedScheme} style={[{ flex: 1, height: '100%', width: '100%' }, props.style]}>
      <OverlayProvider>
        <ToastProvider>{props.children}</ToastProvider>
      </OverlayProvider>
    </View>
  );
}

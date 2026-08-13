'use client';
import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { ToastProvider } from '@gluestack-ui/core/toast/creator';
import React, { useLayoutEffect } from 'react';
import { Appearance, View, type ViewProps } from 'react-native';

export type ModeType = 'light' | 'dark' | 'system';

export function GluestackUIProvider({ mode = 'light', ...props }: { mode?: ModeType; children?: React.ReactNode; style?: ViewProps['style'] }) {
  // Both the tokens (--color-*) and the `dark:` variant flip through the prefers-color-scheme media
  // query, which react-native-css drives from Appearance — hence the override below.
  useLayoutEffect(() => {
    Appearance.setColorScheme(mode === 'system' ? null : mode);
  }, [mode]);

  // This View deliberately carries NO className. It wraps the entire app, and react-native-css wraps
  // any classed component in an element of its own; with a class here every native ScrollView beneath
  // it stopped responding to a plain drag app-wide — only a Pressable taking the JS responder could
  // scroll anything. Style it inline if it ever needs styling, and see the dark variant in global.css.
  return (
    <View style={[{ flex: 1, height: '100%', width: '100%' }, props.style]}>
      <OverlayProvider>
        <ToastProvider>{props.children}</ToastProvider>
      </OverlayProvider>
    </View>
  );
}

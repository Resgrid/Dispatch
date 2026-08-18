'use client';

import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';

interface BottomAnchoredKeyboardViewProps {
  children: React.ReactNode;
  /**
   * Height in dp of any chrome sitting between this container and the bottom of the
   * display — a bottom tab bar, most often. The keyboard already covers that chrome, so
   * it is space this view must not pad for a second time.
   */
  offset?: number;
  style?: ViewStyle;
}

/**
 * Padding a bottom-anchored container owes the keyboard.
 *
 * `animatedHeight` is the library's keyboard value: 0 when closed, and negative while the
 * keyboard is up, since it is published for `translateY`. Marked as a worklet so the
 * animated style can call it on the UI thread.
 */
export const keyboardPaddingBottom = (animatedHeight: number, offset: number): number => {
  'worklet';

  return Math.max(-animatedHeight - offset, 0);
};

/**
 * Keyboard avoidance for a container whose bottom edge *is* the bottom of the screen.
 *
 * `KeyboardAvoidingView` derives its padding from where it believes it sits on screen:
 * `frame.y + frame.height` versus `screenHeight - keyboardHeight`. Its `automaticOffset`
 * prop is what makes that frame absolute — it asks the native side for
 * `getLocationOnScreen` once per layout, over a promise. Under a native-stack header on
 * Android that measurement is the entire fix, and when it is stale, rejected, or resolved
 * mid-transition the padding comes up short by the header plus the status bar, which is
 * exactly enough for the keyboard to sit over the composer.
 *
 * This view measures nothing. The container already ends at the bottom of the screen, so
 * the gap it owes is precisely the keyboard height, on both platforms.
 *
 * Only for full-bleed screen content. Anything that does not reach the bottom of the
 * screen (bottom sheets, inset cards) still needs a measuring variant — see
 * `useKeyboardHeight` for the sheet case, which lives in its own native window.
 */
export const BottomAnchoredKeyboardView: React.FC<BottomAnchoredKeyboardViewProps> = ({ children, offset = 0, style }) => {
  // Also arms Android's resize mode, the way `KeyboardAvoidingView` did.
  const { height } = useReanimatedKeyboardAnimation();
  const animatedStyle = useAnimatedStyle(() => ({ paddingBottom: keyboardPaddingBottom(height.value, offset) }), [offset]);

  return <Reanimated.View style={[styles.fill, style, animatedStyle]}>{children}</Reanimated.View>;
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

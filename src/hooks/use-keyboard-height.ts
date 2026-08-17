import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Current soft-keyboard height in dp, or 0 when it is closed.
 *
 * Bottom sheets render inside a native `Modal`, which owns its own window.
 * react-native-keyboard-controller's inset animations are bound to the main window,
 * so `KeyboardAvoidingView`/`KeyboardAwareScrollView` never move sheet content and the
 * keyboard sits on top of it. React Native's own `Keyboard` events are dispatched
 * regardless of which window is focused, so they still describe the keyboard correctly
 * inside a sheet — use them to size the gap the sheet needs to leave.
 *
 * iOS gets the `Will` events so the sheet moves with the keyboard animation; Android only
 * reports usable frames on `Did`.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return height;
}

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Current soft-keyboard height in dp, or 0 when it is closed.
 *
 * Bottom sheets render inside a native `Modal`, which owns its own window. The modal
 * window itself never resizes or pans for the keyboard on either platform, so the sheet
 * must leave the gap itself — pad `ActionsheetContent` by this height and the
 * content-sized, bottom-anchored sheet slides up out from under the keyboard.
 *
 * IMPORTANT: this must be the ONLY keyboard compensation inside a sheet. Do NOT nest a
 * `KeyboardAwareScrollView`/`KeyboardAvoidingView` in sheet content: keyboard events are
 * window-agnostic on both platforms, so those components still fire inside the modal and
 * shift the content a second keyboard-height, pushing it out of the visible sheet.
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

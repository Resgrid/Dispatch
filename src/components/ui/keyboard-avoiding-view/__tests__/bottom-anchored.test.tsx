import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { BottomAnchoredKeyboardView, keyboardPaddingBottom } from '../bottom-anchored';

jest.mock('react-native-keyboard-controller', () => ({
  useReanimatedKeyboardAnimation: () => ({ height: { value: 0 }, progress: { value: 0 } }),
}));

describe('keyboardPaddingBottom', () => {
  it('leaves no gap while the keyboard is closed', () => {
    expect(keyboardPaddingBottom(0, 0)).toBe(0);
  });

  it('pads by the full keyboard height, which the library reports negative', () => {
    expect(keyboardPaddingBottom(-320, 0)).toBe(320);
  });

  it('subtracts chrome the keyboard already covers, such as a bottom tab bar', () => {
    expect(keyboardPaddingBottom(-320, 60)).toBe(260);
  });

  it('never pads when the offset alone exceeds the keyboard', () => {
    expect(keyboardPaddingBottom(-40, 60)).toBe(0);
  });

  it('clamps at zero so an unexpected positive height cannot pull the content down', () => {
    expect(keyboardPaddingBottom(40, 0)).toBe(0);
  });
});

describe('BottomAnchoredKeyboardView', () => {
  it('renders its children', () => {
    render(
      <BottomAnchoredKeyboardView>
        <Text>composer</Text>
      </BottomAnchoredKeyboardView>
    );

    expect(screen.getByText('composer')).toBeTruthy();
  });
});

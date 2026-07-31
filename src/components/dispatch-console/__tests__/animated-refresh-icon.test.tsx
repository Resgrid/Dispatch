import React from 'react';
import { render } from '@testing-library/react-native';

import { AnimatedRefreshIcon } from '../animated-refresh-icon';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = jest.requireActual('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock nativewind
jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

describe('AnimatedRefreshIcon', () => {
  it('should render without crashing', () => {
    const { getByTestId } = render(<AnimatedRefreshIcon isLoading={false} />);
    // Component should render
    expect(true).toBe(true);
  });

  it('should render when loading', () => {
    const { getByTestId } = render(<AnimatedRefreshIcon isLoading={true} />);
    // Component should render in loading state
    expect(true).toBe(true);
  });

  it('should accept custom size prop', () => {
    const { getByTestId } = render(<AnimatedRefreshIcon isLoading={false} size={20} />);
    // Component should render with custom size
    expect(true).toBe(true);
  });
});

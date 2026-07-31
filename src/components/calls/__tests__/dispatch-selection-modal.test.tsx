import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { DispatchSelectionModal } from '../dispatch-selection-modal';

// Mock the dispatch store with proper typing
const mockDispatchStore = {
  data: {
    users: [{ Id: '1', Name: 'John Doe' }],
    groups: [{ Id: '1', Name: 'Fire Department' }],
    roles: [{ Id: 'Captain', Name: 'Captain' }],
    units: [{ Id: '1', Name: 'Engine 1' }],
  },
  selection: {
    everyone: false,
    users: [] as string[],
    groups: [] as string[],
    roles: [] as string[],
    units: [] as string[],
  },
  isLoading: false,
  error: null,
  searchQuery: '',
  fetchDispatchData: jest.fn(),
  setSelection: jest.fn(),
  toggleEveryone: jest.fn(),
  toggleUser: jest.fn(),
  toggleGroup: jest.fn(),
  toggleRole: jest.fn(),
  toggleUnit: jest.fn(),
  setSearchQuery: jest.fn(),
  clearSelection: jest.fn(),
  getFilteredData: jest.fn().mockReturnValue({
    users: [{ Id: '1', Name: 'John Doe' }],
    groups: [{ Id: '1', Name: 'Fire Department' }],
    roles: [{ Id: 'Captain', Name: 'Captain' }],
    units: [{ Id: '1', Name: 'Engine 1' }],
  }),
};

jest.mock('@/stores/dispatch/store', () => ({
  useDispatchStore: jest.fn(() => mockDispatchStore),
}));

// Mock the color scheme and cssInterop
jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

// Mock translations
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('DispatchSelectionModal', () => {
  const mockProps = {
    isVisible: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    initialSelection: {
      everyone: false,
      users: [] as string[],
      groups: [] as string[],
      roles: [] as string[],
      units: [] as string[],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when visible', () => {
    const { getByText } = render(<DispatchSelectionModal {...mockProps} />);

    expect(getByText('calls.select_dispatch_recipients')).toBeTruthy();
    expect(getByText('calls.everyone')).toBeTruthy();
    expect(getByText('calls.users (1)')).toBeTruthy();
    expect(getByText('calls.groups (1)')).toBeTruthy();
    expect(getByText('calls.roles (1)')).toBeTruthy();
    expect(getByText('calls.units (1)')).toBeTruthy();
  });

  it('should not render when not visible', () => {
    const { queryByText } = render(
      <DispatchSelectionModal {...mockProps} isVisible={false} />
    );

    expect(queryByText('calls.select_dispatch_recipients')).toBeNull();
  });

  it('should call toggleEveryone when everyone option is pressed', async () => {
    const { getByText } = render(<DispatchSelectionModal {...mockProps} />);

    const everyoneOption = getByText('calls.everyone');
    fireEvent.press(everyoneOption);

    await waitFor(() => {
      expect(mockDispatchStore.toggleEveryone).toHaveBeenCalled();
    });
  });

  it('should call toggleUser when user is pressed', async () => {
    const { getByText } = render(<DispatchSelectionModal {...mockProps} />);

    const userOption = getByText('John Doe');
    fireEvent.press(userOption);

    await waitFor(() => {
      expect(mockDispatchStore.toggleUser).toHaveBeenCalledWith('1');
    });
  });

  it('should call setSearchQuery when search input changes', async () => {
    const { getByPlaceholderText } = render(<DispatchSelectionModal {...mockProps} />);

    const searchInput = getByPlaceholderText('common.search');
    fireEvent.changeText(searchInput, 'test');

    await waitFor(() => {
      expect(mockDispatchStore.setSearchQuery).toHaveBeenCalledWith('test');
    });
  });

  it('should call clearSelection and onClose when cancel button is pressed', async () => {
    const { getByText } = render(<DispatchSelectionModal {...mockProps} />);

    const cancelButton = getByText('common.cancel');
    fireEvent.press(cancelButton);

    await waitFor(() => {
      expect(mockDispatchStore.clearSelection).toHaveBeenCalled();
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  it('should show selection count', () => {
    const { getByText } = render(<DispatchSelectionModal {...mockProps} />);

    // Should show 0 selected by default
    expect(getByText('0 calls.selected')).toBeTruthy();
  });
}); 
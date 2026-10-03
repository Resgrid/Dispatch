import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { readSharedInstallation, saveSharedInstallation, SHARED_INSTALLATION_STORAGE_KEY } from '@/lib/mfa/shared-installation';
import { storage } from '@/lib/storage';
import useAuthStore from '@/stores/auth/store';

import SharedDevice from '../shared-device';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;

jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/stores/auth/store', () => {
  const { create } = require('zustand');
  return { __esModule: true, default: create(() => ({ status: 'signedOut' })) };
});

describe('SharedDevice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.delete(SHARED_INSTALLATION_STORAGE_KEY);
    useAuthStore.setState({ status: 'signedOut' });
    mockCanGoBack = true;
  });

  it('suggests shared for a device nobody has set up, and saves its label', () => {
    const { getByTestId } = render(<SharedDevice />);
    // The label field shows only while "shared" is chosen.
    expect(getByTestId('shared-device-label')).toBeTruthy();

    fireEvent.changeText(getByTestId('shared-device-label'), 'Engine 12');
    fireEvent.press(getByTestId('shared-device-save'));

    expect(readSharedInstallation()).toEqual({ configured: true, shared: true, label: 'Engine 12' });
    expect(mockBack).toHaveBeenCalled();
  });

  it('can be set up as a personal device', () => {
    const { getByTestId, queryByTestId } = render(<SharedDevice />);

    fireEvent(getByTestId('shared-device-toggle'), 'valueChange', false);
    expect(queryByTestId('shared-device-label')).toBeNull();
    fireEvent.press(getByTestId('shared-device-save'));

    expect(readSharedInstallation()).toEqual({ configured: true, shared: false, label: null });
  });

  it('shows a personal device as it was saved', () => {
    saveSharedInstallation({ shared: false, label: null });
    const { queryByTestId } = render(<SharedDevice />);
    expect(queryByTestId('shared-device-label')).toBeNull();
  });

  it('drops the label when shared mode is turned off', () => {
    saveSharedInstallation({ shared: true, label: 'Engine 12' });
    mockCanGoBack = false;
    const { getByTestId } = render(<SharedDevice />);
    expect(getByTestId('shared-device-label').props.value).toBe('Engine 12');

    fireEvent(getByTestId('shared-device-toggle'), 'valueChange', false);
    fireEvent.press(getByTestId('shared-device-save'));

    expect(readSharedInstallation()).toEqual({ configured: true, shared: false, label: null });
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('says a change applies at the next sign-in when someone is signed in', () => {
    useAuthStore.setState({ status: 'signedIn' });
    const { getByTestId } = render(<SharedDevice />);
    expect(getByTestId('shared-device-next-sign-in')).toBeTruthy();
  });
});

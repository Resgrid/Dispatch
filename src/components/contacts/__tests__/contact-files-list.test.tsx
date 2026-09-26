import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert, Platform } from 'react-native';

import { getContactFileBase64 } from '@/api/contacts/contactFiles';
import { type ContactFileResultData } from '@/models/v4/contactFiles/contactFilesResult';

import { ContactFilesList, safeFileName } from '../contact-files-list';

jest.mock('@/hooks/use-analytics', () => ({ useAnalytics: () => ({ trackEvent: jest.fn() }) }));
jest.mock('@/api/contacts/contactFiles', () => ({ getContactFileBase64: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///documents/', EncodingType: { Base64: 'base64' }, writeAsStringAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

// The server's file name is written straight under the document directory, so it must never be
// able to name a path outside it or a file that is not its own.
describe('safeFileName', () => {
  it('keeps an ordinary name', () => {
    expect(safeFileName('Floor plan.pdf', 'fallback')).toBe('Floor plan.pdf');
  });

  it('reduces a path to its last segment', () => {
    expect(safeFileName('../../shared/secrets.json', 'fallback')).toBe('secrets.json');
    expect(safeFileName('/etc/passwd', 'fallback')).toBe('passwd');
    expect(safeFileName('C:\\Users\\me\\plan.pdf', 'fallback')).toBe('plan.pdf');
  });

  it('strips leading dots so a name cannot be a relative segment or a hidden file', () => {
    expect(safeFileName('..', 'fallback')).toBe('fallback');
    expect(safeFileName('...plan.pdf', 'fallback')).toBe('plan.pdf');
    expect(safeFileName('.hidden', 'fallback')).toBe('hidden');
  });

  it('removes characters a file system rejects', () => {
    expect(safeFileName('a<b>c:d"e|f?g*h.txt', 'fallback')).toBe('abcdefgh.txt');
    expect(safeFileName('bad\u0000name.txt', 'fallback')).toBe('badname.txt');
  });

  it('falls back when nothing usable is left', () => {
    expect(safeFileName('', 'contact_file_1')).toBe('contact_file_1');
    expect(safeFileName(null, 'contact_file_1')).toBe('contact_file_1');
    expect(safeFileName(undefined, 'contact_file_1')).toBe('contact_file_1');
    expect(safeFileName('///', 'contact_file_1')).toBe('contact_file_1');
    expect(safeFileName('   ', 'contact_file_1')).toBe('contact_file_1');
  });
});

describe('ContactFilesList download failure', () => {
  const file = { Id: 'f-1', ContactId: 'c-1', Type: 1, TypeName: 'Plan', Name: 'Floor plan', FileName: 'plan.pdf', Mime: 'application/pdf', Size: 2048, Timestamp: '', IsProtected: false } as ContactFileResultData;

  it('tells the dispatcher in the browser, where Alert.alert does nothing', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const browserAlert = jest.fn();
    const nativeAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const previousAlert = window.alert;
    window.alert = browserAlert;
    jest.mocked(getContactFileBase64).mockRejectedValue(new Error('offline'));

    try {
      render(<ContactFilesList files={[file]} />);
      fireEvent.press(screen.getByTestId('contact-file-download-f-1'));

      await waitFor(() => expect(browserAlert).toHaveBeenCalledWith('contacts.files.download_failed'));
      expect(nativeAlert).not.toHaveBeenCalled();
    } finally {
      window.alert = previousAlert;
      nativeAlert.mockRestore();
      jest.restoreAllMocks();
    }
  });
});

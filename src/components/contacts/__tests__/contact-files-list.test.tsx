import { describe, expect, it, jest } from '@jest/globals';

import { safeFileName } from '../contact-files-list';

jest.mock('@/hooks/use-analytics');
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

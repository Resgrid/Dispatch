import { storage } from '@/lib/storage';

import { clientHeaders, ephemeralBrowser } from '../client-app';
import { isSharedInstallation, readSharedInstallation, sanitizeInstallationLabel, saveSharedInstallation, SHARED_INSTALLATION_STORAGE_KEY } from '../shared-installation';

describe('shared installation setting', () => {
  beforeEach(() => {
    storage.delete(SHARED_INSTALLATION_STORAGE_KEY);
  });

  it('is a personal installation until set, and after a corrupt value', () => {
    expect(readSharedInstallation()).toEqual({ configured: false, shared: false, label: null });
    storage.set(SHARED_INSTALLATION_STORAGE_KEY, '{not json');
    expect(readSharedInstallation()).toEqual({ configured: false, shared: false, label: null });
    storage.set(SHARED_INSTALLATION_STORAGE_KEY, JSON.stringify({ shared: 'yes' }));
    expect(isSharedInstallation()).toBe(false);
    expect(readSharedInstallation().configured).toBe(true);
  });

  it('saves the setting and a cleaned, bounded label', () => {
    const saved = saveSharedInstallation({ shared: true, label: '  Engine 12\u0007 MDT  ' });
    expect(saved).toEqual({ configured: true, shared: true, label: 'Engine 12 MDT' });
    expect(readSharedInstallation()).toEqual(saved);
    expect(isSharedInstallation()).toBe(true);

    expect(sanitizeInstallationLabel('x'.repeat(100))).toHaveLength(64);
    expect(sanitizeInstallationLabel('   ')).toBeNull();
    expect(sanitizeInstallationLabel(null)).toBeNull();
  });

  it('asks the server for a shared session, labelled, only on a shared installation', () => {
    expect(clientHeaders()['X-Resgrid-Shared-Installation']).toBeUndefined();
    expect(ephemeralBrowser()).toBe(false);

    saveSharedInstallation({ shared: true, label: 'Engine 12' });
    const headers = clientHeaders();
    expect(headers['X-Resgrid-Client']).toBe('dispatch');
    expect(headers['X-Resgrid-Shared-Installation']).toBe('true');
    expect(headers['X-Resgrid-Device-Name']).toBe('Engine 12');
    expect(ephemeralBrowser()).toBe(true);

    saveSharedInstallation({ shared: false, label: 'ignored' });
    expect(clientHeaders()['X-Resgrid-Shared-Installation']).toBeUndefined();
    expect(readSharedInstallation().label).toBe('ignored');
  });

  it('sends a label that is not header-safe as the device name instead', () => {
    saveSharedInstallation({ shared: true, label: 'Ηλεκτρονικό' });
    const headers = clientHeaders();
    expect(headers['X-Resgrid-Shared-Installation']).toBe('true');
    expect(headers['X-Resgrid-Device-Name']).not.toBe('Ηλεκτρονικό');
  });
});

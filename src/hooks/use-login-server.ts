import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { describeLoginServer, type LoginServer } from '@/lib/login-server';
import { getBaseApiUrl } from '@/lib/storage/app';
import { useServerUrlStore } from '@/stores/app/server-url-store';

/**
 * The server this device signs in to, and its display name ("US West", "EU Central" or "Custom (host)"). Follows a
 * server change made from the login screen, since saving one updates the server URL store.
 */
export const useLoginServer = (): LoginServer & { name: string } => {
  const { t } = useTranslation();
  const storeUrl = useServerUrlStore((state) => state.url);
  const apiUrl = storeUrl || getBaseApiUrl();

  return useMemo(() => {
    const server = describeLoginServer(apiUrl);
    const name = server.kind === 'custom' ? t('login.server.custom_host', { host: server.host }) : t(`login.server.${server.kind}`);
    return { ...server, name };
  }, [apiUrl, t]);
};

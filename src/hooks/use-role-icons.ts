import { useEffect, useState } from 'react';

import { getRecipients } from '@/api/messaging/messages';
import { logger } from '@/lib/logging';

/**
 * The department's uploaded role icons by lowercase role name, for screens that only know a person's role names
 * (PersonnelInfoResultData.Roles). Read from the recipients list, the one payload that carries every role with its
 * icon; the call uses the same arguments as the dispatch store, so it shares that cached response. Empty until loaded,
 * and on failure (callers fall back to their plain role marker).
 */
export const useRoleIcons = (): ReadonlyMap<string, string> => {
  const [icons, setIcons] = useState<ReadonlyMap<string, string>>(() => new Map());

  useEffect(() => {
    let cancelled = false;

    getRecipients(true, false)
      .then((result) => {
        if (cancelled) return;
        const byName = new Map<string, string>();
        for (const recipient of result?.Data ?? []) {
          if (recipient?.Type === 'Roles' && recipient.Name && recipient.TypeIconUrl) byName.set(recipient.Name.trim().toLowerCase(), recipient.TypeIconUrl);
        }
        setIcons(byName);
      })
      .catch((error) => {
        if (!cancelled) logger.warn({ message: 'Failed to load role icons', context: { error } });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return icons;
};

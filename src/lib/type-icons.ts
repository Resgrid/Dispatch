import { MAP_ICONS } from '@/constants/map-icons';

export type TypeMapIconEntry = (typeof MAP_ICONS)[string];

/**
 * The uploaded icon URL a department gave a unit, call or POI type (Core's `TypeIconUrl` / `IconUrl` fields)
 * when it is usable, otherwise null. Only absolute http(s) URLs are accepted: the server sends an absolute,
 * anonymous, immutable image URL, and anything else (blank, relative, another scheme) is treated as "no upload".
 */
export const getTypeIconUrl = (iconUrl?: string | null): string | null => {
  if (typeof iconUrl !== 'string') return null;
  const trimmed = iconUrl.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null;
};

/**
 * The bundled map icon a unit or call type picked (Core's `TypeMapIcon` / `MapIcon`, a lowercase MAP_ICONS key such
 * as "ambulance" or "fire"), normalized the way map pin tokens are, or undefined when the name is blank or unknown
 * to this build.
 */
export const getTypeMapIcon = (mapIcon?: string | null): TypeMapIconEntry | undefined => {
  if (typeof mapIcon !== 'string') return undefined;
  const key = mapIcon
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '');
  if (!key || !Object.prototype.hasOwnProperty.call(MAP_ICONS, key)) return undefined;
  return MAP_ICONS[key];
};

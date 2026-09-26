import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

/**
 * Pin types returned by the Core map API (`/Mapping/GetMapDataAndMarkers`).
 */
export const MapPinType = {
  Call: 0,
  Unit: 1,
  Station: 2,
  Personnel: 3,
  Poi: 4,
  Hydrant: 5,
} as const;

// The Core map API prefixes each pin id with its type so ids are unique across types
// (`c123` is call 123, `p<guid>` a person). Servers from before that change send the bare id.
const PIN_ID_PREFIXES: Record<number, string> = {
  [MapPinType.Call]: 'c',
  [MapPinType.Unit]: 'u',
  [MapPinType.Station]: 's',
  [MapPinType.Personnel]: 'p',
  [MapPinType.Poi]: 'poi',
  [MapPinType.Hydrant]: 'hydrant-',
};

const NUMERIC_ID_TYPES = new Set<number>([MapPinType.Call, MapPinType.Unit, MapPinType.Station, MapPinType.Poi]);

type PinIdentity = Pick<MapMakerInfoData, 'Id' | 'Type'>;

/**
 * The id of the call, unit, station, person, POI or hydrant behind a map pin, i.e. the pin id without
 * its type prefix, for routes and stores that take the entity id. A legacy unprefixed id, or an id of
 * any other pin type, is returned unchanged.
 */
export const getPinEntityId = (pin: PinIdentity): string => {
  const id = pin.Id == null ? '' : String(pin.Id).trim();
  const prefix = PIN_ID_PREFIXES[pin.Type];

  if (!prefix || id.length <= prefix.length || id.slice(0, prefix.length).toLowerCase() !== prefix) {
    return id;
  }

  const entityId = id.slice(prefix.length);

  // Call, unit, station and POI ids are numbers; anything else is not a prefixed id, so leave it alone.
  if (NUMERIC_ID_TYPES.has(pin.Type) && !/^\d+$/.test(entityId)) {
    return id;
  }

  return entityId;
};

export const isCallPin = (pin: Pick<MapMakerInfoData, 'Type'>): boolean => pin.Type === MapPinType.Call;

/**
 * Whether the pin is the given call, e.g. the active call (stores hold the bare call id).
 */
export const isPinForCall = (pin: PinIdentity, callId: string | number | null | undefined): boolean => callId != null && String(callId) !== '' && isCallPin(pin) && getPinEntityId(pin) === String(callId);

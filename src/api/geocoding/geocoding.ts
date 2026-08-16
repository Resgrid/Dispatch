import { createApiEndpoint } from '../common/client';

/**
 * Geocoding is proxied through the Resgrid API rather than called from the client.
 *
 * Two reasons. First, the Dispatch app's config key never carried a Google Maps key, so every
 * direct lookup failed with "Google Maps API key not configured" and surfaced as "Failed to search
 * for address, please try again". Second, Google's Geocoding *web service* and the what3words API
 * send no CORS headers, so the browser and Electron builds could not call them even with a key —
 * only the native build ever worked. The server-side endpoints also keep the provider keys off the
 * client entirely.
 */

const forwardGeocodeApi = createApiEndpoint('/Geocoding/ForwardGeocode');
const reverseGeocodeApi = createApiEndpoint('/Geocoding/ReverseGeocode');
const what3WordsLookupApi = createApiEndpoint('/Geocoding/What3WordsLookup');
const plusCodeLookupApi = createApiEndpoint('/Geocoding/PlusCodeLookup');

interface ForwardGeocodeResult {
  Data: {
    Latitude: number | null;
    Longitude: number | null;
    Address: string | null;
    LookupSucceeded: boolean;
  };
}

interface ReverseGeocodeResult {
  Data: {
    Address: string | null;
    LookupSucceeded: boolean;
  };
}

/**
 * Shaped like a Google Geocoding result so the existing screens — which render a picker when more
 * than one candidate comes back — keep working unchanged. The server resolves a single best match,
 * so the list holds zero or one entry today.
 */
export interface GeocodeCandidate {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  place_id: string;
}

export interface GeocodeLookup {
  /** True when the lookup ran. False means it failed — a different message to "no match". */
  succeeded: boolean;
  candidates: GeocodeCandidate[];
}

const toCandidates = (data: ForwardGeocodeResult['Data'] | undefined, fallbackAddress: string): GeocodeLookup => {
  if (!data) {
    return { succeeded: false, candidates: [] };
  }

  if (data.Latitude === null || data.Latitude === undefined || data.Longitude === null || data.Longitude === undefined) {
    return { succeeded: data.LookupSucceeded === true, candidates: [] };
  }

  return {
    succeeded: true,
    candidates: [
      {
        formatted_address: data.Address || fallbackAddress,
        geometry: { location: { lat: data.Latitude, lng: data.Longitude } },
        place_id: `${data.Latitude},${data.Longitude}`,
      },
    ],
  };
};

export const forwardGeocode = async (address: string): Promise<GeocodeLookup> => {
  const response = await forwardGeocodeApi.get<ForwardGeocodeResult>({ address });
  return toCandidates(response.data?.Data, address);
};

export const what3WordsLookup = async (words: string): Promise<GeocodeLookup> => {
  const response = await what3WordsLookupApi.get<ForwardGeocodeResult>({ words });
  return toCandidates(response.data?.Data, words);
};

export const plusCodeLookup = async (code: string): Promise<GeocodeLookup> => {
  const response = await plusCodeLookupApi.get<ForwardGeocodeResult>({ code });
  return toCandidates(response.data?.Data, code);
};

export const reverseGeocode = async (lat: number, lon: number): Promise<{ succeeded: boolean; address: string | null }> => {
  const response = await reverseGeocodeApi.get<ReverseGeocodeResult>({ lat, lon });
  const data = response.data?.Data;

  return {
    succeeded: data?.LookupSucceeded === true,
    address: data?.Address || null,
  };
};

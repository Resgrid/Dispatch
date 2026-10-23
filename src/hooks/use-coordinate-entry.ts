import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { reverseGeocode } from '@/api/geocoding/geocoding';
import { type CallPoint, type CoordinateAxis, type CoordinateEntry, isSameCoordinateSpot, parseCoordinate, parseCoordinateEntry, splitCoordinatePair } from '@/lib/call-coordinates';

/** How long the latitude and longitude inputs sit still before what they hold moves the pin. */
export const COORDINATE_ENTRY_DELAY_MS = 2000;

type ShownError = 'invalid' | 'missing' | null;

export interface UseCoordinateEntryOptions {
  latitudeText: string | undefined;
  longitudeText: string | undefined;
  /** Writes one input's text. */
  setText: (axis: CoordinateAxis, text: string) => void;
  /** The call location the form holds now: where the pin is. */
  location: CallPoint | null;
  /** The address input as it stands. */
  address: string | undefined;
  /** Typed coordinates settled on a new point: the call location (and the pin) moves there. */
  onLocationEntered: (location: CallPoint) => void;
  /** Writes the address input with one found for the location, or clears one found for an earlier location. */
  setAddress: (address: string) => void;
  /** Both inputs emptied. Left out where the location cannot be removed (an edit keeps the stored one). */
  onCleared?: () => void;
}

/**
 * The separate latitude and longitude inputs on the new and edit call screens.
 *
 * Once both hold valid decimal degrees and the dispatcher pauses, the pin moves there. A location typed in or
 * picked on the map fills the address only when the dispatcher has not supplied one: geocoding is not always
 * right, so the address they know to be correct is never replaced. An address this filled in itself is not
 * theirs until they change it, so a later point replaces it.
 */
export const useCoordinateEntry = (options: UseCoordinateEntryOptions) => {
  const { t } = useTranslation();
  const { latitudeText, longitudeText, setText } = options;

  // Read by the delayed check and the address lookup, which finish after the render that started them.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const [shownErrors, setShownErrors] = useState<Record<CoordinateAxis, ShownError>>({ latitude: null, longitude: null });
  const [isLookingUpAddress, setIsLookingUpAddress] = useState(false);
  // The address last filled in from a location, as long as it has not been changed since.
  const filledAddressRef = useRef<string | null>(null);
  // Only the latest lookup may write the address: an older one answering late would name the wrong place.
  const lookupIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const isAddressFillable = () => {
    const address = (optionsRef.current.address ?? '').trim();
    return !address || address === filledAddressRef.current;
  };

  const writeAddress = (address: string) => {
    filledAddressRef.current = address.trim() || null;
    optionsRef.current.setAddress(address);
  };

  /** Fills a blank address for a point the dispatcher chose, with one the map picker found already or by looking it up. */
  const fillAddress = useCallback(async (point: CallPoint, foundAddress?: string) => {
    const lookupId = ++lookupIdRef.current;

    if (!isAddressFillable()) {
      setIsLookingUpAddress(false);
      return;
    }

    if (foundAddress?.trim()) {
      setIsLookingUpAddress(false);
      writeAddress(foundAddress);
      return;
    }

    setIsLookingUpAddress(true);
    let address: string | null = null;
    try {
      address = (await reverseGeocode(point.latitude, point.longitude)).address;
    } catch (error) {
      console.error('Error reverse geocoding call coordinates:', error);
    }

    // A newer point took over, or the dispatcher typed an address while this ran.
    if (lookupId !== lookupIdRef.current || !isMountedRef.current) return;
    setIsLookingUpAddress(false);
    if (!isAddressFillable()) return;

    if (address) {
      writeAddress(address);
    } else if (filledAddressRef.current) {
      // Nothing found here: an address filled in for the previous point would now name the wrong place.
      writeAddress('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Acts on the inputs as they stand: errors shown, and a new point applied (or a cleared one removed). */
  const settle = useCallback(
    (flagMissing: boolean): CoordinateEntry => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const { location, onLocationEntered, onCleared } = optionsRef.current;
      const entry = parseCoordinateEntry(optionsRef.current.latitudeText, optionsRef.current.longitudeText);
      const errorFor = (axis: CoordinateAxis): ShownError => {
        if (entry.status === 'invalid') return (axis === 'latitude' ? entry.latitudeInvalid : entry.longitudeInvalid) ? 'invalid' : null;
        return flagMissing && entry.status === 'incomplete' && entry.missing === axis ? 'missing' : null;
      };
      setShownErrors({ latitude: errorFor('latitude'), longitude: errorFor('longitude') });

      if (entry.status === 'valid') {
        // The inputs show where the pin already is (a map click, a lookup, the stored call): keep its full
        // precision, and leave the address alone.
        if (location && isSameCoordinateSpot(entry, location)) {
          return { status: 'valid', latitude: location.latitude, longitude: location.longitude };
        }

        const point = { latitude: entry.latitude, longitude: entry.longitude };
        onLocationEntered(point);
        void fillAddress(point);
      } else if (entry.status === 'empty' && location) {
        onCleared?.();
      }

      return entry;
    },
    [fillAddress]
  );

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      settle(false);
    }, COORDINATE_ENTRY_DELAY_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [latitudeText, longitudeText, settle]);

  /** A whole "lat, lon" pair typed or pasted into either input is split across both. */
  const changeText = useCallback(
    (axis: CoordinateAxis, text: string) => {
      const pair = splitCoordinatePair(text);

      if (pair) {
        setText('latitude', pair.latitude);
        setText('longitude', pair.longitude);
        return;
      }

      setText(axis, text);
    },
    [setText]
  );

  /** Applies the inputs now (Enter, or a save), rather than after the pause; missing halves are flagged too. */
  const commit = useCallback(() => settle(true), [settle]);

  // An error stays up only while the input still has it, so it clears as soon as the value is fixed.
  const errorMessage = (axis: CoordinateAxis, text: string | undefined): string | undefined => {
    const status = parseCoordinate(text, axis).status;

    if (shownErrors[axis] === 'invalid' && status === 'invalid') {
      return t(axis === 'latitude' ? 'calls.latitude_invalid' : 'calls.longitude_invalid');
    }

    if (shownErrors[axis] === 'missing' && status === 'empty') {
      return t('calls.coordinates_incomplete');
    }

    return undefined;
  };

  return {
    latitudeError: errorMessage('latitude', latitudeText),
    longitudeError: errorMessage('longitude', longitudeText),
    isLookingUpAddress,
    changeText,
    commit,
    fillAddress,
  };
};

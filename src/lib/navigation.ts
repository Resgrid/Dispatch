import { type Href, router } from 'expo-router';
import { Linking, Platform } from 'react-native';

import { logger } from './logging';

export interface RouterPushRetryOptions {
  maxAttempts?: number;
  retryDelayMs?: number;
}

/**
 * Pushes an expo-router href, retrying when the router has not mounted yet
 * (cold-start deep links). Throws the last error once every attempt fails.
 */
export const routerPushWithRetry = async (href: Href, options?: RouterPushRetryOptions): Promise<void> => {
  const maxAttempts = options?.maxAttempts ?? 1;
  const retryDelayMs = options?.retryDelayMs ?? 250;

  for (let attempt = 1; ; attempt++) {
    try {
      router.push(href);
      return;
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
};

/**
 * Opens the device's native maps application with directions using an address.
 *
 * @param address - The destination address
 * @returns Promise<boolean> - True if the maps app was successfully opened
 */
export const openMapsWithAddress = async (address: string): Promise<boolean> => {
  const encodedAddress = encodeURIComponent(address);
  let url = '';

  // Platform-specific URL schemes
  if (Platform.OS === 'ios') {
    // Apple Maps (iOS)
    url = `maps://maps.apple.com/?daddr=${encodedAddress}&dirflg=d`;
  } else if (Platform.OS === 'android') {
    // Google Maps (Android)
    url = `google.navigation:q=${encodedAddress}`;
  } else if (Platform.OS === 'web') {
    // Google Maps (Web)
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`;
  } else if (Platform.OS === 'windows' || Platform.OS === 'macos') {
    // For desktop platforms, use web URL that will open in browser
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`;
  }

  // Fallback to web URL if platform-specific URL is empty
  if (!url) {
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`;
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    } else {
      // If the specific map app can't be opened, try a web fallback
      const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`;
      await Linking.openURL(webUrl);
      return true;
    }
  } catch (error) {
    logger.error({
      message: 'Failed to open maps application with address',
      context: { error, url, address },
    });
    return false;
  }
};

/**
 * Opens the device's native maps application with directions from the user's current location
 * to the specified destination coordinates.
 *
 * This function works across all platforms: iOS, Android, Web, Windows, and macOS.
 *
 * @param destinationLatitude - The latitude of the destination
 * @param destinationLongitude - The longitude of the destination
 * @param destinationName - Optional name/label for the destination
 * @param originLatitude - Optional latitude of the starting point (if not provided, current location is used)
 * @param originLongitude - Optional longitude of the starting point (if not provided, current location is used)
 * @returns Promise<boolean> - True if the maps app was successfully opened
 */
export const openMapsWithDirections = async (
  destinationLatitude: number | string,
  destinationLongitude: number | string,
  destinationName?: string,
  originLatitude?: number | string,
  originLongitude?: number | string
): Promise<boolean> => {
  // Convert coordinates to strings if they're numbers
  const destLat = typeof destinationLatitude === 'number' ? destinationLatitude.toString() : destinationLatitude;
  const destLng = typeof destinationLongitude === 'number' ? destinationLongitude.toString() : destinationLongitude;

  let url = '';

  // Platform-specific URL schemes
  if (Platform.OS === 'ios') {
    // Apple Maps (iOS)
    if (originLatitude && originLongitude) {
      // With specific origin
      const originLat = typeof originLatitude === 'number' ? originLatitude.toString() : originLatitude;
      const originLng = typeof originLongitude === 'number' ? originLongitude.toString() : originLongitude;
      url = `maps://maps.apple.com/?saddr=${originLat},${originLng}&daddr=${destLat},${destLng}&dirflg=d`;
    } else {
      // Using current location as origin
      url = `maps://maps.apple.com/?daddr=${destLat},${destLng}&dirflg=d`;
    }
  } else if (Platform.OS === 'android') {
    // Google Maps (Android)
    if (originLatitude && originLongitude) {
      // With specific origin
      const originLat = typeof originLatitude === 'number' ? originLatitude.toString() : originLatitude;
      const originLng = typeof originLongitude === 'number' ? originLongitude.toString() : originLongitude;
      url = `google.navigation:q=${destLat},${destLng}&origin=${originLat},${originLng}`;
    } else {
      // Using current location as origin
      url = `google.navigation:q=${destLat},${destLng}`;
    }
  } else if (Platform.OS === 'web') {
    // Google Maps (Web)
    if (originLatitude && originLongitude) {
      // With specific origin
      const originLat = typeof originLatitude === 'number' ? originLatitude.toString() : originLatitude;
      const originLng = typeof originLongitude === 'number' ? originLongitude.toString() : originLongitude;
      url = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;
    } else {
      // Using current location as origin (Google Maps will ask for permission)
      url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
    }
  } else if (Platform.OS === 'windows' || Platform.OS === 'macos') {
    // For desktop platforms, use web URL that will open in browser
    if (originLatitude && originLongitude) {
      // With specific origin
      const originLat = typeof originLatitude === 'number' ? originLatitude.toString() : originLatitude;
      const originLng = typeof originLongitude === 'number' ? originLongitude.toString() : originLongitude;
      url = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;
    } else {
      // Using current location as origin
      url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
    }
  }

  // Fallback to web URL if platform-specific URL is empty
  if (!url) {
    url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    } else {
      // If the specific map app can't be opened, try a web fallback
      const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
      await Linking.openURL(webUrl);
      return true;
    }
  } catch (error) {
    logger.error({
      message: 'Failed to open maps application',
      context: { error, url },
    });
    return false;
  }
};

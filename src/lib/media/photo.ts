import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

// One photo from the camera or the library, normalised for upload: HEIC and other camera formats become
// JPEG, the long side is bounded, and metadata (GPS, device) is dropped by the re-encode. Receipts, work
// order photos and certificate scans all go through here. Cache copies are removed; a camera-roll original
// never is.

export interface CapturedPhoto {
  base64: string;
  uri: string;
  name: string;
  contentType: 'image/jpeg';
  width: number;
  height: number;
}

export class PhotoPermissionError extends Error {
  constructor() {
    super('denied');
  }
}

const MAX_EDGE = 2048;

export const capturePhoto = async (source: 'camera' | 'library', name = `photo-${Date.now()}.jpg`): Promise<CapturedPhoto | null> => {
  const permission = await (source === 'camera' ? ImagePicker.requestCameraPermissionsAsync() : ImagePicker.requestMediaLibraryPermissionsAsync());
  if (!permission.granted) throw new PhotoPermissionError();
  const result = await (source === 'camera' ? ImagePicker.launchCameraAsync({ quality: 0.8, exif: false }) : ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, exif: false }));
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  let converted: { uri: string; base64?: string; width: number; height: number } | null = null;
  try {
    const resize = asset.width >= asset.height ? { width: Math.min(asset.width || MAX_EDGE, MAX_EDGE) } : { height: Math.min(asset.height || MAX_EDGE, MAX_EDGE) };
    converted = await manipulateAsync(asset.uri, [{ resize }], { format: SaveFormat.JPEG, compress: 0.8, base64: true });
    if (!converted.base64) return null;
    return { base64: converted.base64, uri: converted.uri, name: name.toLowerCase().endsWith('.jpg') ? name : `${name}.jpg`, contentType: 'image/jpeg', width: converted.width, height: converted.height };
  } finally {
    if (FileSystem.cacheDirectory && asset.uri.startsWith(FileSystem.cacheDirectory) && asset.uri !== converted?.uri) await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => undefined);
  }
};

/** Removes an app cache copy made by {@link capturePhoto} once it has been uploaded. */
export const discardPhoto = async (photo: CapturedPhoto | null | undefined) => {
  if (photo?.uri && FileSystem.cacheDirectory && photo.uri.startsWith(FileSystem.cacheDirectory)) await FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(() => undefined);
};

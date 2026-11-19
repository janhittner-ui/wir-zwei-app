/**
 * Fotos auswählen oder aufnehmen und für das Album vorbereiten:
 * auf höchstens 1600 Pixel verkleinern und neu als JPEG speichern. Dabei fallen Zusatzdaten
 * wie der Aufnahmeort (GPS) weg; die Auswahl liest sie gar nicht erst aus (exif: false).
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { PhotoUpload } from '@/data/types';

const MAX = 1600;
export const MAX_PER_UPLOAD = 20;

export class PickError extends Error {}

export async function pickPhotos(source: 'library' | 'camera'): Promise<ImagePicker.ImagePickerAsset[]> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
  let res: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PickError('Bitte erlaube den Zugriff auf die Kamera in den iPhone-Einstellungen.');
    res = await ImagePicker.launchCameraAsync(opts);
  } else {
    res = await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: MAX_PER_UPLOAD, orderedSelection: true });
  }
  return res.canceled ? [] : res.assets;
}

export async function preparePhoto(asset: { uri: string; width: number; height: number }): Promise<PhotoUpload> {
  const ctx = ImageManipulator.manipulate(asset.uri);
  const w = asset.width || MAX;
  const h = asset.height || MAX;
  if (Math.max(w, h) > MAX) ctx.resize(w >= h ? { width: MAX } : { height: MAX });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
  if (!out.base64) throw new PickError('Dieses Bild konnte nicht gelesen werden.');
  return { base64: out.base64, width: Math.round(out.width), height: Math.round(out.height) };
}

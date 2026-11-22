import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { ReadFile } from './ai';

/** 画像の長い辺。Claudeはこれより大きい画像を縮めて読むので、送る前に縮めて通信量を減らす */
const MAX_EDGE = 1568;
/** PDFの大きさの上限（中継サーバーの上限 20MB を base64 で超えないように） */
const MAX_PDF_BYTES = 12 * 1024 * 1024;

export class CaptureError extends Error {
  code: 'permission' | 'too_large';
  constructor(code: 'permission' | 'too_large') {
    super(code);
    this.code = code;
  }
}

async function toJpeg(asset: ImagePicker.ImagePickerAsset): Promise<ReadFile> {
  const long = Math.max(asset.width, asset.height);
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (long > MAX_EDGE) {
    ctx.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ base64: true, compress: 0.85, format: SaveFormat.JPEG });
  return { mediaType: 'image/jpeg', data: saved.base64 ?? '' };
}

/** カメラで1ページ撮る。取り消したら null */
export async function takePhoto(): Promise<ReadFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new CaptureError('permission');
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled || !result.assets[0]) return null;
  return toJpeg(result.assets[0]);
}

/** 写真から選ぶ（複数ページ可） */
export async function pickPhotos(limit: number): Promise<ReadFile[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 1,
  });
  if (result.canceled) return [];
  return Promise.all(result.assets.map(toJpeg));
}

/** PDFを1つ選ぶ */
export async function pickPdf(): Promise<ReadFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if ((asset.size ?? 0) > MAX_PDF_BYTES) throw new CaptureError('too_large');
  const data = await new File(asset.uri).base64();
  return { mediaType: 'application/pdf', data };
}

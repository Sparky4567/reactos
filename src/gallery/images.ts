import type { FSNode } from '@/os/types';
export interface GalleryImage { id: string; name: string; type: string; size: number; createdAt: string }
export interface ViewerImage { id: string; name: string; src: string; size?: number; path?: string[] }
export const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export function fileSystemImages(root: FSNode, path: string[] = []): ViewerImage[] {
  if (root.type === 'file') {
    if (!IMAGE_EXT.test(root.name)) return [];
    const source = root.content || '';
    return [{ id: `fs:${JSON.stringify(path)}`, name: root.name, path, size: root.size,
      src: /^data:image\/(png|jpeg|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i.test(source) ? source : '' }];
  }
  return (root.children || []).flatMap(node => fileSystemImages(node, [...path, node.name]));
}
export function detectImage(bytes: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 8 && bytes.slice(0, 8).every((v, i) => v === [137,80,78,71,13,10,26,10][i])) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(ascii(0, 6))) return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(0, 2) === 'BM') return 'image/bmp';
  if (ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) return 'image/avif';
  return null;
}

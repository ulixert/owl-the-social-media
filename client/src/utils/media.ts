// Uploaded media is stored as plain URLs on a post (`images: string[]`). The
// server names files `<uuid>.<ext>` from the upload's mime type, so the
// extension reliably tells a video from an image — no schema/type field needed.
const VIDEO_EXT = /\.(mp4|webm)(\?.*)?$/i;

export function isVideoUrl(url: string): boolean {
  return VIDEO_EXT.test(url);
}

export function isVideoFile(file: File): boolean {
  return file.type === 'video/mp4' || file.type === 'video/webm';
}

import { join } from 'path';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4'];
export const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

// The extension a stored file is saved and served with is derived from this
// map (keyed by the validated mimetype), never from the client-supplied
// original filename — otherwise a request can declare `image/jpeg` (passing
// the filter) while naming the file `x.html`, and the static file server
// would then serve attacker-controlled content as `text/html`.
export const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
};

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_VIDEO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const UPLOAD_DIR = join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');

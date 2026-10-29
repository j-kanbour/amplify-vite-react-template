import { isEmployeeDocument } from './employee-documents';

/**
 * What may be uploaded where in the profile bucket. profileAccess checks a
 * put against these and binds the type and size into the presigned URL, so S3
 * refuses anything else; the app uses them for its file pickers.
 */

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
// HEIC is what iPhones take photos in; it can be downloaded but not previewed
export const DOCUMENT_TYPES = [...IMAGE_TYPES, 'image/heic', 'image/heif', 'application/pdf'] as const;

/** Types the document preview shows inline. Anything else is download-only. */
export const PREVIEW_TYPES: readonly string[] = [...IMAGE_TYPES, 'application/pdf'];

const MB = 1024 * 1024;

export type UploadRule = { types: readonly string[]; maxBytes: number; what: string };

const PICTURE: UploadRule = { types: IMAGE_TYPES, maxBytes: 5 * MB, what: 'Pictures' };
const DOCUMENT: UploadRule = { types: DOCUMENT_TYPES, maxBytes: 10 * MB, what: 'Documents' };

/** The rule for an upload to path (already split into folders), or undefined if nothing may go there. */
export function uploadRule([root, , ...rest]: string[]): UploadRule | undefined {
  const file = rest.join('/');
  if (root === 'users' && file === 'avatar') return PICTURE;
  if (root === 'orgs' && file === 'logo') return PICTURE;
  if (root === 'users' && rest.length === 2 && rest[0] === 'documents' && isEmployeeDocument(rest[1])) return DOCUMENT;
  return undefined;
}

/** Why a file breaks a rule, or null if it's fine. */
export function uploadProblem(rule: UploadRule, type: string, size: number) {
  if (!rule.types.includes(type)) {
    return rule.types.includes('application/pdf')
      ? 'Upload a PDF or a photo (PNG, JPEG, WebP or HEIC).'
      : 'Upload a PNG, JPEG or WebP image.';
  }
  if (!Number.isInteger(size) || size <= 0) return 'That file is empty.';
  if (size > rule.maxBytes) return `${rule.what} can be up to ${rule.maxBytes / MB} MB.`;
  return null;
}

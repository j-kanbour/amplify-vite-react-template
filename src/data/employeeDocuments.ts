import { useCallback, useEffect, useState } from 'react';
import { client } from './client';
import { presign, uploadFile } from './profileFile';
import { PREVIEW_TYPES } from '../../amplify/data/upload-rules';

/** Where an employee's document lives in the profile bucket, beside their avatar. */
export const documentPath = (userId: string, key: string) => `users/${userId}/documents/${key}`;

/** Keys (from employee-documents.ts) of the documents the user has uploaded. */
export async function listUploadedDocuments(userId: string) {
  const prefix = `users/${userId}/documents/`;
  const { data, errors } = await client.mutations.profileFile({ path: prefix, action: 'list' });
  if (errors?.length) throw new Error(errors[0].message);
  return (data?.keys ?? []).flatMap((k) => (k ? [k.slice(prefix.length)] : []));
}

/** Replaces whatever was uploaded for that document before. */
export const uploadDocument = (userId: string, key: string, file: File) =>
  uploadFile(documentPath(userId, key), file);

/**
 * Downloads a document into the page, to show from a blob: URL, which only
 * works in this tab, so there's no link to copy and pass around.
 *
 * A blob: URL runs with the app's own origin, so an SVG or HTML file opened
 * from one (say with "Open image in new tab") could run script as the app.
 * The type is the uploader's say-so, so only the types the preview can show
 * are kept; anything else becomes an opaque download.
 */
export async function fetchDocument(userId: string, key: string) {
  const res = await fetch(await presign(documentPath(userId, key), 'get'));
  if (!res.ok) throw new Error(`Could not load the document (${res.status})`);
  const blob = await res.blob();
  const type = PREVIEW_TYPES.includes(blob.type) ? blob.type : 'application/octet-stream';
  return { blob: new Blob([blob], { type }), originalType: blob.type };
}

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
};

/** Files are stored without an extension, so take one from the type they were uploaded with. */
export const fileExtension = (type: string) => EXTENSIONS[type] ?? type.split('/')[1]?.split(/[+;]/)[0] ?? 'bin';

/** The documents a user has uploaded. `uploaded` is null while loading. */
export function useUploadedDocuments(userId?: string) {
  const [loaded, setLoaded] = useState<{ userId: string; keys?: string[]; error?: string }>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let current = true;
    listUploadedDocuments(userId).then(
      (keys) => current && setLoaded({ userId, keys }),
      (err) =>
        current && setLoaded({ userId, error: err instanceof Error ? err.message : 'Could not load documents.' }),
    );
    return () => {
      current = false;
    };
  }, [userId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  // Keyed by user so the last person's documents never show for the next
  const mine = userId && loaded?.userId === userId ? loaded : undefined;
  return { uploaded: mine?.keys ?? null, error: mine?.error ?? null, reload };
}

import { client } from './client';
import { uploadProblem, uploadRule } from '../../amplify/data/upload-rules';

/** Asks profileAccess for a presigned URL to get the file at path, or put `file` there. */
export async function presign(path: string, action: 'get' | 'put', file?: File) {
  const { data, errors } = await client.mutations.profileFile({
    path,
    action,
    contentType: file?.type,
    size: file?.size,
  });
  if (errors || !data?.url) throw new Error(errors?.[0]?.message ?? 'No URL returned');
  return data.url;
}

/**
 * Uploads file to path. The Lambda checks it against upload-rules.ts too and
 * the URL only takes this exact type and size; checking here first just gives
 * the message without the round trip.
 */
export async function uploadFile(path: string, file: File) {
  const rule = uploadRule(path.split('/'));
  const problem = rule ? uploadProblem(rule, file.type, file.size) : "Files can't be uploaded there.";
  if (problem) throw new Error(problem);

  const res = await fetch(await presign(path, 'put', file), {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

// Presigned URLs last 5 minutes; reuse them for a little less than that so a
// list of avatars doesn't call the Lambda again on every render or selection
const REUSE_MS = 4 * 60 * 1000;
const cache = new Map<string, { at: number; url: Promise<string> }>();

/** presign(path, 'get'), shared between everything showing the same file. */
export function presignedGet(path: string) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < REUSE_MS) return hit.url;
  const url = presign(path, 'get');
  cache.set(path, { at: Date.now(), url });
  return url;
}

const listeners = new Set<(path: string) => void>();

/** Subscribes to photoChanged; returns the unsubscribe. */
export function onPhotoChanged(listener: (path: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Call after uploading to path, so everything showing it fetches the new one. */
export function photoChanged(path: string) {
  cache.delete(path);
  listeners.forEach((l) => l(path));
}

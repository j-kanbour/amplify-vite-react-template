import { client } from './client';

/** Asks profileAccess for a presigned URL to get or put the file at path. */
export async function presign(path: string, action: 'get' | 'put') {
  const { data, errors } = await client.mutations.profileFile({ path, action });
  if (errors || !data?.url) throw new Error(errors?.[0]?.message ?? 'No URL returned');
  return data.url;
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

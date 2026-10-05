import { useEffect, useState } from 'react';
import { onPhotoChanged, presignedGet } from './profileFile';

/**
 * A viewable URL for a picture in the profile bucket (users/{id}/avatar,
 * orgs/{id}/logo), refetched when it's re-uploaded. src is undefined while
 * loading, when there's nothing there, or when the caller can't see it.
 */
export function useProfilePhoto(path?: string) {
  // Keyed by path so a stale picture never shows while the next one loads
  const [loaded, setLoaded] = useState<{ path: string; url?: string }>();
  const [version, setVersion] = useState(0);

  useEffect(() => onPhotoChanged((changed) => changed === path && setVersion((v) => v + 1)), [path]);

  useEffect(() => {
    if (!path) return;
    let current = true;
    presignedGet(path).then((url) => current && setLoaded({ path, url }), () => {});
    return () => {
      current = false;
    };
  }, [path, version]);

  return {
    src: path && loaded?.path === path ? loaded.url : undefined,
    // a 403/404 from S3 just means nothing's been uploaded yet
    onError: () => path && setLoaded({ path }),
  };
}

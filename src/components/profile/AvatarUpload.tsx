import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Button } from '@aws-amplify/ui-react';
import { LuCamera } from 'react-icons/lu';
import { presign } from '../../data/profileFile';
import { initials } from '../../utils/initials';

type Props = {
  /** S3 key in the profile bucket, e.g. users/{userId}/avatar or orgs/{orgId}/logo. */
  path: string;
  /** Used for the initials shown until a picture is uploaded. */
  name?: string | null;
  /** 'round' for people, 'square' for organisation logos. */
  shape?: 'round' | 'square';
  buttonLabel: string;
  /** Title, subtitle, badges: whatever sits beside the picture. */
  children?: ReactNode;
};

/** Profile picture beside the heading, with an upload button. Falls back to initials. */
export default function AvatarUpload({ path, name, shape = 'round', buttonLabel, children }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setSrc(undefined);
    presign(path, 'get').then(setSrc, () => {});
  }, [path]);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be picked again
    if (!file) return;

    setUploading(true);
    setError(undefined);
    try {
      const res = await fetch(await presign(path, 'put'), {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      setSrc(await presign(path, 'get'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="ts-profile__identity">
      <span className={`ts-profile__avatar ts-profile__avatar--${shape}`} aria-hidden>
        {src ? (
          // a 403/404 here just means nothing's been uploaded yet
          <img className="ts-profile__avatar-img" src={src} alt="" onError={() => setSrc(undefined)} />
        ) : (
          initials(name)
        )}
      </span>
      <div className="ts-profile__identity-text">
        {children}
        <Button
          size="small"
          className="ts-profile__upload"
          isLoading={uploading}
          loadingText="Uploading…"
          onClick={() => inputRef.current?.click()}
        >
          <LuCamera aria-hidden /> {buttonLabel}
        </Button>
        {error && <p className="ts-profile__meta" role="alert">{error}</p>}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} />
      </div>
    </div>
  );
}

import { useRef, type ChangeEvent, type ReactNode } from 'react';
import { Button } from '@aws-amplify/ui-react';
import { LuCamera } from 'react-icons/lu';
import { initials } from '../../utils/initials';

type Props = {
  /** Used for the initials shown until a picture is uploaded. */
  name?: string | null;
  /** 'round' for people, 'square' for organisation logos. */
  shape?: 'round' | 'square';
  buttonLabel: string;
  /** Title, subtitle, badges: whatever sits beside the picture. */
  children?: ReactNode;
};

/** Picture (initials for now) beside the profile heading, with an upload button. */
export default function AvatarUpload({ name, shape = 'round', buttonLabel, children }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be picked again
    if (!file) return;
    // TODO: upload to S3 (Amplify Storage) and save the key on the record
  }

  return (
    <div className="ts-profile__identity">
      <span className={`ts-profile__avatar ts-profile__avatar--${shape}`} aria-hidden>
        {initials(name)}
      </span>
      <div className="ts-profile__identity-text">
        {children}
        <Button size="small" className="ts-profile__upload" onClick={() => inputRef.current?.click()}>
          <LuCamera aria-hidden /> {buttonLabel}
        </Button>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} />
      </div>
    </div>
  );
}

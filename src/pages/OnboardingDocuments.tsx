import { useRef, useState, type ChangeEvent } from 'react';
import { Alert, Button, useAuthenticator } from '@aws-amplify/ui-react';
import { LuCheck, LuFileText, LuUpload } from 'react-icons/lu';
import { useUser } from '../context/UserContext';
import InviteShell from '../components/InviteShell';
import { uploadDocument, useUploadedDocuments } from '../data/employeeDocuments';
import { documentLabel } from '../../amplify/data/employee-documents';
import { DOCUMENT_TYPES } from '../../amplify/data/upload-rules';

/** One document the org asked for: its name, whether it's in, and a button to upload it. */
function DocumentRow({ userId, docKey, uploaded, onUploaded }: { userId: string; docKey: string; uploaded: boolean; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be picked again
    if (!file) return;

    setUploading(true);
    setError(undefined);
    try {
      await uploadDocument(userId, docKey, file);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <li className="ts-docs__item">
      <span className={`ts-docs__icon${uploaded ? ' ts-docs__icon--done' : ''}`} aria-hidden>
        {uploaded ? <LuCheck /> : <LuFileText />}
      </span>
      <span className="ts-docs__text">
        <span className="ts-docs__name">{documentLabel(docKey)}</span>
        <span className="ts-docs__status">{error ?? (uploaded ? 'Uploaded' : 'Not uploaded yet')}</span>
      </span>
      <Button size="small" isLoading={uploading} loadingText="Uploading…" onClick={() => inputRef.current?.click()}>
        <LuUpload aria-hidden /> {uploaded ? 'Replace' : 'Upload'}
      </Button>
      <input ref={inputRef} type="file" accept={DOCUMENT_TYPES.join(',')} hidden onChange={handleFile} />
    </li>
  );
}

/**
 * Where an invited employee uploads the documents their org asked for
 * (/onboarding/documents). OnboardingGate keeps them here until every one is in.
 */
export default function OnboardingDocuments() {
  const { user, org, memberships, refresh } = useUser();
  const { signOut } = useAuthenticator();
  const { uploaded, error, reload } = useUploadedDocuments(user?.id);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const required = memberships.find((m) => m.orgId === org?.id)?.requiredDocuments ?? [];
  const done = !!uploaded && required.every((d) => uploaded.includes(d));

  async function finish() {
    setFinishing(true);
    setFinishError(null);
    try {
      // OnboardingGate moves them on once refresh sees nothing missing
      await refresh();
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setFinishing(false);
    }
  }

  return (
    <InviteShell
      title="Upload your documents"
      sub={`${org?.name ?? 'Your organisation'} needs these before you can get started. Photos or PDFs up to 10 MB.`}
    >
      {error && <Alert variation="error">{error}</Alert>}
      {user && uploaded === null && !error ? (
        <p className="ts-onboarding__account">Loading…</p>
      ) : (
        user && (
          <ul className="ts-docs">
            {required.map((d) => (
              <DocumentRow key={d} userId={user.id} docKey={d} uploaded={!!uploaded?.includes(d)} onUploaded={reload} />
            ))}
          </ul>
        )
      )}
      {finishError && <Alert variation="error">{finishError}</Alert>}
      <Button variation="primary" onClick={finish} isDisabled={!done} isLoading={finishing} loadingText="Finishing…">
        Continue
      </Button>
      <Button variation="link" onClick={signOut}>
        Sign out
      </Button>
    </InviteShell>
  );
}

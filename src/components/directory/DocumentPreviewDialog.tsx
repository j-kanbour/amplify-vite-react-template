import { useEffect, useRef, useState } from 'react';
import { Alert, Button } from '@aws-amplify/ui-react';
import { LuDownload, LuX } from 'react-icons/lu';
import { fetchDocument, fileExtension } from '../../data/employeeDocuments';
import { PREVIEW_TYPES } from '../../../amplify/data/upload-rules';
import { documentLabel } from '../../../amplify/data/employee-documents';

type Props = {
  /** The employee and document to show; the dialog is open while this is set. */
  doc: { userId: string; userName: string; key: string } | null;
  onClose: () => void;
};

/**
 * Shows an employee's document inside the page, with a button to download it.
 * The file is fetched into the page and shown from a blob: URL, so there's no
 * shareable link in the address bar or on screen.
 */
export default function DocumentPreviewDialog({ doc, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // Keyed by the document so the last one never shows while the next loads
  // type is what the preview may treat it as; originalType names the downloaded file
  const [loaded, setLoaded] = useState<{
    doc: Props['doc'];
    url?: string;
    type?: string;
    originalType?: string;
    error?: string;
  }>();
  const open = !!doc;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!doc) return;
    let current = true;
    let url: string | undefined;
    fetchDocument(doc.userId, doc.key).then(
      ({ blob, originalType }) => {
        if (!current) return;
        url = URL.createObjectURL(blob);
        setLoaded({ doc, url, type: blob.type, originalType });
      },
      (err) => current && setLoaded({ doc, error: err instanceof Error ? err.message : 'Could not load the document.' }),
    );
    return () => {
      current = false;
      // Frees the copy held in memory once it's closed or replaced
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc]);

  const shown = doc && loaded?.doc === doc ? loaded : undefined;
  const label = doc ? documentLabel(doc.key) : '';
  const type = shown?.type ?? '';
  const fileName = doc ? `${doc.userName} - ${label}.${fileExtension(shown?.originalType ?? '')}` : '';
  const previewable = PREVIEW_TYPES.includes(type);

  return (
    <dialog
      ref={ref}
      className="ts-dialog ts-dialog--wide"
      aria-labelledby="document-preview-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ts-dialog__body">
        <div className="ts-dialog__head">
          <div>
            <h2 id="document-preview-title" className="ts-dialog__title">{label}</h2>
            <p className="ts-dialog__sub">{doc?.userName}</p>
          </div>
          <button type="button" className="ts-dialog__close" onClick={onClose} aria-label="Close">
            <LuX aria-hidden />
          </button>
        </div>

        <div className="ts-preview">
          {shown?.error ? (
            <Alert variation="error">{shown.error}</Alert>
          ) : !shown?.url ? (
            <p className="ts-directory__muted">Loading…</p>
          ) : previewable && type.startsWith('image/') ? (
            <img className="ts-preview__img" src={shown.url} alt={label} />
          ) : previewable && type === 'application/pdf' ? (
            // Not sandboxed: Chrome won't show a PDF in a sandboxed frame. The
            // browser's PDF viewer can't reach the page either way.
            <iframe className="ts-preview__frame" src={shown.url} title={label} />
          ) : (
            <p className="ts-directory__muted">This file can’t be previewed. Download it to open it.</p>
          )}
        </div>

        <div className="ts-dialog__actions">
          <Button onClick={onClose}>Close</Button>
          {shown?.url && (
            <a className="amplify-button amplify-button--primary" href={shown.url} download={fileName}>
              <LuDownload aria-hidden /> Download
            </a>
          )}
        </div>
      </div>
    </dialog>
  );
}

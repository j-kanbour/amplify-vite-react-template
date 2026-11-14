import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@aws-amplify/ui-react';
import { LuPrinter, LuX } from 'react-icons/lu';
import { useUser } from '../../context/UserContext';
import { useProfilePhoto } from '../../data/useProfilePhoto';
import { initials } from '../../utils/initials';
import { byShowcaseOrder, type Bundle } from '../../data/useBundles';
import BundleCard from './BundleCard';

type Props = {
  bundles: Bundle[];
  onClose: () => void;
  /** Open straight into the browser's print dialog (for "Save as PDF"), and close once it's done. */
  print?: boolean;
};

/**
 * The org's bundles as a full-screen showcase for showing a parent, which is
 * also what prints: the print styles in index.css hide the rest of the app
 * while it's open (body.ts-presenting). Escape or the × closes it.
 */
export default function BundlePresentation({ bundles, onClose, print = false }: Props) {
  const { org } = useUser();
  const logo = useProfilePhoto(org ? `orgs/${org.id}/logo` : undefined);
  // The page passes a fresh onClose each render; the effects below must not re-run for that
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    document.body.classList.add('ts-presenting');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    // Fill the screen when presenting; printing from full screen is awkward, so not then
    if (!print) document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      document.body.classList.remove('ts-presenting');
      document.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [print]);

  useEffect(() => {
    if (!print) return;
    const done = () => closeRef.current();
    window.addEventListener('afterprint', done, { once: true });
    // Let the layout (and the logo, if cached) paint first
    const id = window.setTimeout(() => window.print(), 300);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
    };
  }, [print]);

  const contact = [org?.contactEmail, org?.phone, org?.website].filter((s) => s?.trim());
  const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

  return createPortal(
    <div className="ts-present" role="dialog" aria-modal="true" aria-label="Pricing presentation">
      <div className="ts-present__bar">
        <span className="ts-present__hint">Press Esc to exit</span>
        <Button size="small" onClick={() => window.print()}>
          <LuPrinter aria-hidden /> Print / save as PDF
        </Button>
        <Button size="small" onClick={onClose}>
          <LuX aria-hidden /> Exit
        </Button>
      </div>

      <div className="ts-present__sheet">
        <header className="ts-present__head">
          <span className="ts-present__logo">
            {logo.src ? <img src={logo.src} alt="" onError={logo.onError} /> : initials(org?.name)}
          </span>
          <div>
            <p className="ts-present__org">{org?.name}</p>
            <h1 className="ts-present__title">Tutoring bundles &amp; pricing</h1>
            {contact.length > 0 && <p className="ts-present__contact">{contact.join(' · ')}</p>}
          </div>
        </header>

        <div className="ts-present__grid" data-count={Math.min(bundles.length, 4)}>
          {[...bundles].sort(byShowcaseOrder).map((b) => (
            <BundleCard key={b.id} bundle={b} size="lg" />
          ))}
        </div>

        <footer className="ts-present__foot">
          Prices current as of {today}. {org?.businessNumber && `Business number ${org.businessNumber}.`}
        </footer>
      </div>
    </div>,
    document.body,
  );
}

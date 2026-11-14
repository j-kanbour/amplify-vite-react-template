import type { ReactNode } from 'react';
import { LuCheck, LuStar, LuTag } from 'react-icons/lu';
import { bundleFeatures, formatPrice, type Bundle } from '../../data/useBundles';

/**
 * One pricing option. The same card is used on the Bundles page, in
 * presentation mode and in the printed sheet; `size="lg"` is the presentation
 * version. `actions` (edit/remove) only appear for admins on the page.
 */
export default function BundleCard({ bundle, size, actions }: { bundle: Bundle; size?: 'lg'; actions?: ReactNode }) {
  const price = formatPrice(bundle.price);
  const features = bundleFeatures(bundle);
  const offer = [bundle.discount, bundle.discountTime].filter((s) => s?.trim()).join(' · ');

  return (
    <article
      className={`ts-bundle${bundle.featured ? ' ts-bundle--featured' : ''}${size ? ` ts-bundle--${size}` : ''}`}
      aria-label={bundle.name ?? 'Bundle'}
    >
      {bundle.featured && (
        <span className="ts-bundle__ribbon">
          <LuStar aria-hidden /> Most popular
        </span>
      )}
      <header className="ts-bundle__head">
        <h3 className="ts-bundle__name">{bundle.name}</h3>
        {bundle.description && <p className="ts-bundle__desc">{bundle.description}</p>}
      </header>
      <div className="ts-bundle__price">
        {price ? (
          <>
            <span className="ts-bundle__amount">{price}</span>
            {bundle.priceUnit && <span className="ts-bundle__unit">{bundle.priceUnit}</span>}
          </>
        ) : (
          <span className="ts-bundle__unit">Price on enquiry</span>
        )}
      </div>
      {(bundle.sessions || offer) && (
        <div className="ts-bundle__meta">
          {!!bundle.sessions && (
            <span className="ts-bundle__chip">
              {bundle.sessions} session{bundle.sessions === 1 ? '' : 's'}
            </span>
          )}
          {offer && (
            <span className="ts-bundle__chip ts-bundle__chip--offer">
              <LuTag aria-hidden /> {offer}
            </span>
          )}
        </div>
      )}
      {features.length > 0 && (
        <ul className="ts-bundle__features">
          {features.map((f, i) => (
            <li key={i}>
              <LuCheck aria-hidden /> {f}
            </li>
          ))}
        </ul>
      )}
      {actions && <footer className="ts-bundle__actions">{actions}</footer>}
    </article>
  );
}

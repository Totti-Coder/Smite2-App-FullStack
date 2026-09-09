import type { ReactNode } from 'react';

/**
 * Consistent bento-cell chrome for every dashboard panel: colored accent
 * bar, heading wired to aria-labelledby so each panel is a proper landmark
 * section rather than an anonymous div, optional subtitle/action slot.
 */
export function Panel({
  id,
  title,
  subtitle,
  accent = '#16c8d4',
  action,
  className,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  accent?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={`glass-panel rounded-2xl p-5 ${className ?? ''}`}
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id={id} className="font-display text-sm font-semibold uppercase tracking-wide text-ss-text-secondary">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-ss-text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

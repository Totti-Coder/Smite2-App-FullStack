import Link from 'next/link';
import { GodAvatar } from '@/components/GodAvatar';
import type { Tier } from '@/lib/tier-list';

type GodInfo = { id: string; name: string; icon_url: string | null };

/**
 * Read-only render of a published tier list. Used both full-size on the
 * detail page and shrunk down as a preview card in the public gallery -
 * `size` is the only difference, so the two never drift apart visually.
 */
export function TierListView({
  tiers,
  godById,
  size = 'full',
}: {
  tiers: Tier[];
  godById: Map<string, GodInfo>;
  size?: 'full' | 'preview';
}) {
  const iconPx = size === 'full' ? 44 : 26;
  const labelWidth = size === 'full' ? 'w-16' : 'w-10';
  const labelText = size === 'full' ? 'text-xl' : 'text-xs';
  const rowMinHeight = size === 'full' ? 'min-h-[60px]' : 'min-h-[36px]';

  // A preview card shouldn't stretch to fit someone's 40-god S tier - cap
  // what's shown and count the rest, so every card in the gallery grid
  // stays roughly the same height.
  const previewCap = 12;

  return (
    <div className="flex flex-col gap-1.5">
      {tiers.map((tier) => {
        const gods = tier.godIds.map((id) => godById.get(id)).filter((g): g is GodInfo => Boolean(g));
        const shown = size === 'preview' ? gods.slice(0, previewCap) : gods;
        const hidden = gods.length - shown.length;

        return (
          <div key={tier.id} className="flex overflow-hidden rounded-lg border border-ss-line bg-ss-bg-raised/50">
            <div
              className={`flex ${labelWidth} shrink-0 items-center justify-center ${labelText} font-display font-bold text-ss-bg`}
              style={{ background: tier.color }}
            >
              {tier.label}
            </div>
            <div className={`flex flex-1 flex-wrap items-center gap-1 p-1.5 ${rowMinHeight}`}>
              {shown.map((god) =>
                size === 'full' ? (
                  <Link key={god.id} href={`/gods/${god.id}`} title={god.name} className="transition hover:opacity-80">
                    <GodAvatar iconUrl={god.icon_url} name={god.name} size={iconPx} />
                  </Link>
                ) : (
                  <GodAvatar key={god.id} iconUrl={god.icon_url} name={god.name} size={iconPx} />
                )
              )}
              {hidden > 0 && <span className="px-1 text-[10px] text-ss-text-muted">+{hidden}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

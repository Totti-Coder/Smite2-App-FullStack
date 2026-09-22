/**
 * An item's icon, with a real fallback when there isn't one.
 *
 * Every item image is hotlinked from SmiteSource's CDN under an asset name
 * that does NOT follow from the display name - "Devourer's Gauntlet" is
 * stored as `DevoursGloves`, "Book of Thoth" as `BookofThroth_Evolved`
 * (typo included). That name can only be read off the source, so newly
 * released items reach this catalog before their icon path is known.
 *
 * Previously `icon_url` was a non-null string and every call site rendered a
 * bare <img>, which meant an item with no known icon could only be added by
 * shipping a URL that 404s - a visibly broken image with no fallback. Making
 * it nullable and centralising the fallback here means a new item can be
 * listed with its name, tier and cost the day it ships, and gain its artwork
 * later without touching anything else.
 */
export function ItemArt({
  iconUrl,
  name,
  size = 36,
  className = '',
  rounded = 'rounded',
}: {
  iconUrl: string | null;
  name: string;
  size?: number;
  className?: string;
  rounded?: string;
}) {
  if (!iconUrl) {
    return (
      <span
        aria-hidden="true"
        title={name}
        className={`flex shrink-0 items-center justify-center border border-dashed border-ss-line bg-ss-bg-raised font-semibold text-ss-text-muted ${rounded} ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size / 3.2)) }}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external CDN icon, intentionally not run through next/image
    <img
      src={iconUrl}
      alt=""
      // The build picker renders the whole catalog at once (265 icons), so
      // these must not all be requested up front.
      loading="lazy"
      decoding="async"
      className={`shrink-0 ${rounded} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * "Ritual of the Full Moon" -> "RF": the first letters of the words that
 * actually distinguish one item from another. Filler words are dropped -
 * without that, "the" (three letters) survived a naive length filter and
 * produced "RT", which tells the reader nothing.
 */
const FILLER = new Set(['of', 'the', 'a', 'an', 'and', 'de', 'del', 'la', 'el', 'los', 'las', 'y']);

function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w.toLowerCase()));
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

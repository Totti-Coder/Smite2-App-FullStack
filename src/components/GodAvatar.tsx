import Image from 'next/image';

export function GodAvatar({
  iconUrl,
  name,
  size = 40,
}: {
  iconUrl: string | null;
  name: string;
  size?: number;
}) {
  if (!iconUrl) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-ss-bg-raised text-xs font-semibold text-ss-text-muted"
        style={{ width: size, height: size }}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={iconUrl}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full border border-ss-line bg-ss-bg-raised object-cover object-top"
      style={{ width: size, height: size }}
    />
  );
}

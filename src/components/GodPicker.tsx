'use client';

import { useRouter } from 'next/navigation';

type God = { id: string; name: string };

export function GodPicker({ gods, currentGodId }: { gods: God[]; currentGodId: string }) {
  const router = useRouter();

  return (
    <select
      aria-label="Cambiar de dios"
      value={currentGodId}
      onChange={(e) => router.push(`/gods/${e.target.value}`)}
      className="rounded-md border border-ss-line bg-ss-bg-raised px-3 py-2 text-sm text-ss-text outline-none focus:border-ss-cyan"
    >
      {gods.map((g) => (
        <option key={g.id} value={g.id}>{g.name}</option>
      ))}
    </select>
  );
}

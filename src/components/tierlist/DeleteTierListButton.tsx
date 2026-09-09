'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteTierList } from '@/app/(app)/tierlist/actions';
import { TrashIcon, CheckIcon, CloseIcon } from '@/components/icons';

// Same inline confirm-in-place pattern as the match delete control
// (components/partidas/MatchesList.tsx) rather than a native confirm(),
// so both destructive actions in the app behave identically.
export function DeleteTierListButton({ id }: { id: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'confirming' | 'deleting' | 'error'>('idle');

  async function confirmDelete() {
    setState('deleting');
    const res = await deleteTierList(id);
    if (res.error) {
      setState('error');
      return;
    }
    router.push('/tierlist');
    router.refresh();
  }

  if (state === 'confirming') {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-ss-loss/40 bg-ss-bg/95 py-1 pl-3 pr-1.5">
        <span className="text-[11px] font-medium whitespace-nowrap text-ss-loss">¿Eliminar?</span>
        <button
          type="button"
          onClick={confirmDelete}
          title="Sí, eliminar"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-ss-loss text-white transition hover:brightness-110"
        >
          <CheckIcon size={12} />
        </button>
        <button
          type="button"
          onClick={() => setState('idle')}
          title="Cancelar"
          className="flex h-6 w-6 items-center justify-center rounded-full border border-ss-line text-ss-text-muted transition hover:text-ss-text"
        >
          <CloseIcon size={12} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setState(state === 'error' ? 'confirming' : 'confirming')}
      disabled={state === 'deleting'}
      className="neu-raised flex items-center gap-1.5 rounded-md border border-ss-line bg-ss-bg-raised px-3 py-1.5 text-xs text-ss-text-secondary transition hover:border-ss-loss/40 hover:text-ss-loss disabled:opacity-50"
    >
      <TrashIcon size={13} />
      {state === 'deleting' ? 'Eliminando...' : state === 'error' ? 'Falló, reintentar' : 'Eliminar'}
    </button>
  );
}

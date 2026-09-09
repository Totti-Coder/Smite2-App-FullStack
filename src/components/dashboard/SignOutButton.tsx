import { signOut } from '@/app/auth/actions';
import { LogOutIcon } from '@/components/icons';

export function SignOutButton() {
  return (
    <form action={signOut}>
      {/* Real tactile press: lifts slightly on hover (shadow), visibly sinks
          on click (translate down + scale down + shadow drops to none) -
          not just a color swap. Red tint on hover signals "this ends your
          session" without being alarmist (only on interaction, not at rest). */}
      <button
        type="submit"
        className="flex items-center gap-1.5 rounded-md border border-ss-line bg-ss-bg-raised px-3 py-1.5 text-xs font-medium text-ss-text-secondary shadow-sm shadow-black/30 transition-all duration-150 hover:-translate-y-0.5 hover:border-ss-loss/40 hover:bg-ss-loss/10 hover:text-ss-loss hover:shadow-md hover:shadow-ss-loss/10 active:translate-y-0 active:scale-95 active:shadow-none"
      >
        <LogOutIcon size={13} />
        Salir
      </button>
    </form>
  );
}

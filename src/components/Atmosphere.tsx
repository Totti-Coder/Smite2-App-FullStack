// Static grain + vignette layer over the whole app. Pure CSS, no JS, no
// external assets - cheap enough to never touch performance or accessibility
// (it's decorative, non-interactive, and unaffected by reduced-motion since
// nothing here moves).
export function Atmosphere() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[5]" aria-hidden="true">
      <div className="absolute inset-0 vignette-overlay" />
      <div className="absolute inset-0 grain-overlay" />
    </div>
  );
}

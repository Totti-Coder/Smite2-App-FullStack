// Decorative-only background layer: a masked dot grid plus two slow-drifting
// blurred neon orbs (purple + cyan, matching the app's own accent palette -
// not new colors invented for this). Used behind the login hero, where the
// page opts OUT of the video/god-portrait background (see login/page.tsx),
// so there's nothing else fighting it for attention.
export function DotGridOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 dot-grid" />
      <div className="orb orb-purple" />
      <div className="orb orb-cyan" />
    </div>
  );
}

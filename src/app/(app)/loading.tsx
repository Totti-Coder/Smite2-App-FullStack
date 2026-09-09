// Shown by Next automatically while a route segment's server data is being
// fetched (App Router's built-in Suspense boundary) - without this the user
// stared at a blank page for however long the Supabase query took. Shaped
// roughly like the dashboard's bento grid since that's the most-visited
// route, but generic enough to not look wrong flashing briefly on the other
// pages too.
function Block({ className }: { className?: string }) {
  return <div className={`skeleton rounded-xl border border-ss-line ${className ?? ''}`} />;
}

export default function Loading() {
  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-10" aria-busy="true" aria-label="Cargando">
      <Block className="mb-8 h-28" />
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Block className="h-24" />
        <Block className="h-24" />
        <Block className="h-24" />
        <Block className="h-24" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Block className="h-64 lg:col-span-8" />
        <Block className="h-64 lg:col-span-4" />
        <Block className="h-48 lg:col-span-6" />
        <Block className="h-48 lg:col-span-6" />
      </div>
    </main>
  );
}

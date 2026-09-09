import { FaqAccordion } from '@/components/FaqAccordion';
import { FAQ } from '@/data/faq';

export default function FaqPage() {
  return (
    <main id="contenido" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-ss-text">Preguntas frecuentes</h1>
        <p className="mt-1 text-sm text-ss-text-muted">Todo sobre Smite 2 y cómo funciona esta web.</p>
      </div>
      <FaqAccordion categories={FAQ} />
    </main>
  );
}

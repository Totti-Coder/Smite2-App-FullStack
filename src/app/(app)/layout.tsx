import { Header } from '@/components/Header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* WCAG 2.4.1: without this, reaching a page's actual content by
          keyboard means tabbing past the logo, 7 nav links, the search box
          and the auth buttons - on every single page. Visually hidden until
          focused, so it costs the design nothing. Each page's <main> carries
          id="contenido". */}
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <Header />
      {children}
    </>
  );
}

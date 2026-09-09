import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import { BackgroundGods } from "@/components/BackgroundGods";
import { Atmosphere } from "@/components/Atmosphere";
import { MotionRoot } from "@/components/motion/MotionRoot";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Smite 2 Tracker",
    template: "%s · Smite 2 Tracker",
  },
  description: "Dashboard personal de estadísticas de Smite 2: winrate, KDA, builds, matchups y más.",
  applicationName: "Smite 2 Tracker",
  // This is a private, login-gated single-user app - there's nothing here
  // that should ever show up in Google. Explicit noindex is the correct
  // "SEO" move for authenticated dashboards (same call GitHub/Linear/Vercel
  // make for their app shells), not an oversight.
  robots: { index: false, follow: false },
  openGraph: {
    title: "Smite 2 Tracker",
    description: "Dashboard personal de estadísticas de Smite 2.",
    siteName: "Smite 2 Tracker",
    locale: "es_ES",
    type: "website",
  },
  // icon.svg (src/app/icon.svg) is picked up automatically by Next's file
  // convention - this explicit entry just makes favicon.ico an actual
  // fallback for browsers that don't support SVG favicons, instead of the
  // untouched default Next.js scaffold icon silently winning by default.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
  },
  // Emits the apple-mobile-web-app-* meta tags - the iOS-specific half of
  // "Add to Home Screen" (Android/desktop read manifest.ts for the rest).
  // black-translucent lets the page draw under the status bar instead of
  // leaving a plain white/black bar above it, matching the dark theme.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Smite 2 Tracker",
  },
};

export const viewport = {
  // Exporting `viewport` at all replaces Next's implicit default entirely -
  // it does NOT merge with it. Omitting width/initialScale here (as an
  // earlier pass did, only setting themeColor) silently killed the
  // responsive viewport meta tag sitewide: mobile browsers then fall back
  // to rendering at a virtual desktop-width viewport (~980px) and zooming
  // the whole page out to fit, which reads as "everything got bigger/
  // wrong-sized" on both mobile (not actually responsive anymore) and
  // desktop (browser chrome/zoom compensating for it).
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0d15",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${spaceGrotesk.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ss-bg font-sans text-ss-text">
        <BackgroundGods />
        <Atmosphere />
        <MotionRoot>{children}</MotionRoot>
      </body>
    </html>
  );
}

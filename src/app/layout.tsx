import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { GoogleAnalytics } from '@/components/ui/Analytics/GoogleAnalytics';

// Brand face for the whole site. Self-hosted via next/font (single woff2 from
// our own origin, zero layout shift) — this replaced a render-blocking CSS
// @import AND a duplicate <link> to fonts.googleapis.com, which also let the
// CSP drop the Google Fonts origins entirely.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bricolage',
  axes: ['opsz'],
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
});

// Inter powers the admin panel's body/data text (headings stay Bricolage
// Grotesque). Exposed as a CSS variable so only the admin styles consume it —
// the marketing site is unaffected.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// No maximumScale: capping it blocks pinch-zoom on iOS, which is a WCAG 1.4.4
// failure — users must be able to zoom the loan terms they're agreeing to.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#15803d",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://finriseo.com"),
  title: {
    default: "Finriseo | Compare Loans from 50+ NBFCs",
    template: "%s | Finriseo",
  },
  description:
    "Compare personal, business and education loan offers from 50+ RBI-registered NBFCs. Instant approval, zero paperwork, competitive rates.",
  keywords: [
    "personal loan",
    "business loan",
    "education loan",
    "loan comparison",
    "NBFC",
    "RBI registered",
    "India",
  ],
  openGraph: {
    title: "Finriseo | Compare Loans from 50+ NBFCs",
    description:
      "Compare personal, business and education loan offers from 50+ RBI-registered NBFCs. Instant approval, zero paperwork, competitive rates.",
    url: "https://finriseo.com",
    siteName: "Finriseo",
    // og:image is provided automatically by src/app/opengraph-image.tsx — the
    // previous "/og-image.png" did not exist, which is why share/search
    // previews fell back to a generic image.
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Finriseo | Compare Loans from 50+ NBFCs",
    description:
      "Compare personal, business and education loan offers from 50+ RBI-registered NBFCs. Instant approval, zero paperwork, competitive rates.",
  },
  // Icons are provided by the file-convention assets in src/app/
  // (icon.svg, icon.png, apple-icon.png) — Next links them automatically.
  // No explicit `icons` here so it can't override those.
  manifest: '/manifest.json',
  // Search Console is verified via DNS (Domain property), so no meta-tag
  // verification is needed here.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${dmMono.variable} ${inter.variable}`}>
      <body>
        <a href="#main-content" className="skip-nav">Skip to main content</a>
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID ?? ''} />
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}

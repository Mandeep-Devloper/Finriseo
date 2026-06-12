import type { Metadata, Viewport } from "next";
import { DM_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { GoogleAnalytics } from '@/components/ui/Analytics/GoogleAnalytics';

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Finriseo Loan Comparison",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Finriseo | Compare Loans from 50+ NBFCs",
    description:
      "Compare personal, business and education loan offers from 50+ RBI-registered NBFCs. Instant approval, zero paperwork, competitive rates.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
  manifest: '/manifest.json',
  verification: {
    google: 'PASTE_YOUR_GSC_VERIFICATION_CODE_HERE',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap" rel="stylesheet" />
      </head>
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

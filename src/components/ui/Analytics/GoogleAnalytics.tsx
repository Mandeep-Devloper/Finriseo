'use client';
import Script from 'next/script';

interface Props {
  gaId: string;
}

export function GoogleAnalytics({ gaId }: Props) {
  if (process.env.NODE_ENV !== 'production') return null;
  // Without an ID this would still inject `gtag/js?id=` — a broken request on
  // every page view whenever NEXT_PUBLIC_GA_ID is unset in production.
  if (!gaId) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}', {
            page_path: window.location.pathname,
            anonymize_ip: true,
          });
        `}
      </Script>
    </>
  );
}

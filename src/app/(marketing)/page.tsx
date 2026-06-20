import { Metadata } from 'next';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Hero from '@/components/sections/Hero/Hero';
import LoanProducts from '@/components/sections/LoanProducts/LoanProducts';
import Partners from '@/components/sections/Partners/Partners';
import StatsBanner from '@/components/sections/StatsBanner/StatsBanner';
import WhyChooseUs from '@/components/sections/WhyChooseUs/WhyChooseUs';
import Testimonials from '@/components/sections/Testimonials/Testimonials';
import { JsonLd } from '@/components/ui/JsonLd/JsonLd';

const ScrollSteps = dynamic(() => import('@/components/sections/ScrollSteps/ScrollSteps'), {
  loading: () => <div style={{ height: '300vh' }} />,
});

const EmiCalculator = dynamic(() => import('@/components/sections/EmiCalculator/EmiCalculator'), {
  loading: () => <div style={{ minHeight: 400 }} />,
});

const Faq = dynamic(() => import('@/components/sections/Faq/Faq'), {
  loading: () => <div style={{ minHeight: 400 }} />,
});

export const metadata: Metadata = {
  title: 'Finriseo | Compare Personal Loans from 50+ NBFCs | Best Rates',
  description: 'Compare personal, business & education loan offers from 50+ RBI-registered NBFCs. Check eligibility in 2 mins. Instant approval, zero paperwork, lowest interest rates in India.',
  keywords: ['personal loan', 'business loan', 'education loan', 'loan comparison India', 'NBFC loan', 'instant loan approval', 'compare loan rates', 'finriseo', 'RBI registered lenders', 'loan without paperwork'],
  authors: [{ name: 'Finriseo', url: 'https://finriseo.com' }],
  creator: 'Finriseo',
  publisher: 'UpAndAlone Fintech Pvt. Ltd.',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://finriseo.com',
    siteName: 'Finriseo',
    title: 'Compare Personal Loans from 50+ NBFCs | Finriseo',
    description: 'Find the best loan offers from 50+ RBI-registered NBFCs. Instant approval, zero paperwork.',
    images: [{ url: 'https://finriseo.com/opengraph-image.png', width: 1200, height: 630, alt: 'Finriseo — Compare Loans from 50+ NBFCs' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Finriseo | Compare Loans from 50+ NBFCs',
    description: 'Find best loan offers from 50+ RBI-registered NBFCs. Instant approval, zero paperwork.',
    creator: '@finriseo',
    images: ['https://finriseo.com/opengraph-image.png'],
  },
  alternates: {
    canonical: 'https://finriseo.com',
  },
};

export default function HomePage() {
  return (
    <>
      <div className="hero-scroll-group">
        <Hero />
        <Suspense fallback={<div className="section" />}>
          <ScrollSteps />
        </Suspense>
      </div>
      <LoanProducts />
      <Partners />
      <StatsBanner />
      <Suspense fallback={<div className="section" />}>
        <EmiCalculator />
      </Suspense>
      <WhyChooseUs />
      <Testimonials />
      <Suspense fallback={<div className="section" />}>
        <Faq />
      </Suspense>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FinancialService",
        "name": "Finriseo",
        "alternateName": "UpAndAlone Fintech Pvt. Ltd.",
        "url": "https://finriseo.com",
        "logo": "https://finriseo.com/logo.webp",
        "description": "India's trusted loan comparison platform connecting borrowers with RBI-registered NBFCs.",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "301, FinServe Tower, BKC",
          "addressLocality": "Mumbai",
          "addressRegion": "Maharashtra",
          "postalCode": "400051",
          "addressCountry": "IN"
        },
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": "+91-1800-123-456",
          "contactType": "customer service",
          "availableLanguage": ["English", "Hindi"],
          "hoursAvailable": "Mo-Sa 09:00-19:00"
        },
        "sameAs": [
          "https://linkedin.com/company/finriseo",
          "https://twitter.com/finriseo"
        ],
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.8",
          "reviewCount": "200000",
          "bestRating": "5"
        }
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is Finriseo?",
            "acceptedAnswer": { "@type": "Answer", "text": "Finriseo is a loan comparison platform that connects borrowers with 50+ RBI-registered NBFCs. We are not a bank or lender — we help you compare the best loan offers in one place." }
          },
          {
            "@type": "Question",
            "name": "Does checking eligibility on Finriseo affect my CIBIL score?",
            "acceptedAnswer": { "@type": "Answer", "text": "No. Checking your loan eligibility on Finriseo is a soft inquiry and does not affect your CIBIL score in any way." }
          },
          {
            "@type": "Question",
            "name": "How quickly can I get a loan through Finriseo?",
            "acceptedAnswer": { "@type": "Answer", "text": "Most applicants receive approval within 10 minutes and loan disbursement can happen on the same day, subject to lender verification." }
          },
          {
            "@type": "Question",
            "name": "Is my personal data safe with Finriseo?",
            "acceptedAnswer": { "@type": "Answer", "text": "Yes. We use bank-grade encryption and are fully compliant with India's Digital Personal Data Protection Act 2023. We never sell your data to third parties." }
          }
        ]
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Finriseo",
        "url": "https://finriseo.com",
        "potentialAction": {
          "@type": "SearchAction",
          "target": { "@type": "EntryPoint", "urlTemplate": "https://finriseo.com/search?q={search_term_string}" },
          "query-input": "required name=search_term_string"
        }
      }} />
    </>
  );
}

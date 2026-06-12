import type { Metadata } from 'next';
import { ShieldCheck, Users, TrendingUp, Award } from 'lucide-react';
import Link from 'next/link';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: "About Finriseo | India's Trusted Loan Comparison Platform",
  description: "Learn about Finriseo — connecting 2L+ Indians with verified RBI-registered NBFCs for transparent loan comparison.",
};

const STATS = [
  { value: '2,00,000+', label: 'Happy Customers' },
  { value: '₹500 Cr+', label: 'Loans Disbursed' },
  { value: '50+', label: 'NBFC Partners' },
  { value: '4.8/5', label: 'Customer Rating' },
];

const VALUES = [
  { icon: ShieldCheck, title: 'Transparency', desc: 'We show all fees, rates, and terms upfront. No hidden charges, ever.' },
  { icon: TrendingUp, title: 'Speed', desc: 'From application to approval in under 10 minutes with our digital-first process.' },
  { icon: Users, title: 'Inclusion', desc: 'Making credit accessible to every Indian — salaried, self-employed, or business owner.' },
  { icon: Award, title: 'Trust', desc: 'Every NBFC partner is RBI-registered and verified. Your money and data are always safe.' },
];

export default function AboutPage() {
  return (
    <main className={styles.page}>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          {/* <span className={styles.eyebrow}>About Finriseo</span> */}
          <h1 className={styles.heroTitle}>
            Simplifying credit for
            <br />
            <span className={styles.heroAccent}>every Indian</span>
          </h1>
          <p className={styles.heroSubtitle}>
            We are on a mission to make loan comparison
            transparent, fast, and accessible for millions
            of Indians across every state and every language.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className={styles.statsSection}>
        <div className={styles.statsGrid}>
          {STATS.map(stat => (
            <div key={stat.label} className={styles.statCard}>
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className={styles.missionSection}>
        <div className={styles.missionGrid}>
          <div className={styles.missionLeft}>
            <span className={styles.eyebrowDark}>Our Mission</span>
            <h2 className={styles.sectionTitle}>
              Making borrowing simple,
              transparent, and fair
            </h2>
            <p className={styles.missionText}>
              Finriseo was built on a simple belief — every Indian
              deserves access to fair credit without confusion,
              hidden fees, or unnecessary paperwork.
            </p>
            <p className={styles.missionText}>
              We connect borrowers directly with RBI-registered
              NBFCs, giving them real offers, real rates, and real
              choices — all in one place.
            </p>
            <Link href="/apply" className={styles.missionCta}>
              Check Your Eligibility →
            </Link>
          </div>
          <div className={styles.missionRight}>
            <div className={styles.companyCard}>
              <div className={styles.companyRow}>
                <span className={styles.companyLabel}>Legal Name</span>
                <span className={styles.companyValue}>UpAndAlone Fintech Pvt. Ltd.</span>
              </div>
              <div className={styles.companyDivider} />
              <div className={styles.companyRow}>
                <span className={styles.companyLabel}>CIN</span>
                <span className={styles.companyValue}>U74999MH2024PTC000000</span>
              </div>
              <div className={styles.companyDivider} />
              <div className={styles.companyRow}>
                <span className={styles.companyLabel}>Headquarters</span>
                <span className={styles.companyValue}>301, FinServe Tower, BKC, Mumbai - 400051</span>
              </div>
              <div className={styles.companyDivider} />
              <div className={styles.companyRow}>
                <span className={styles.companyLabel}>Support</span>
                <span className={styles.companyValue}>Mon - Sat, 9AM - 7PM IST</span>
              </div>
              <div className={styles.companyDivider} />
              <div className={styles.companyRow}>
                <span className={styles.companyLabel}>Email</span>
                <span className={styles.companyValue}>support@finriseo.com</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className={styles.valuesSection}>
        <div className={styles.valuesHeader}>
          {/* <span className={styles.eyebrow}>What We Stand For</span> */}
          <h2 className={styles.valuesSectionTitle}>Our Values</h2>
          <p className={styles.valuesSectionSubtitle}>
            The principles that guide every decision we make
          </p>
        </div>
        <div className={styles.valuesGrid}>
          {VALUES.map(value => {
            const Icon = value.icon;
            return (
              <div key={value.title} className={styles.valueCard}>
                <div className={styles.valueIconWrap}>
                  <Icon size={22} strokeWidth={1.75} />
                </div>
                <h3 className={styles.valueTitle}>{value.title}</h3>
                <p className={styles.valueDesc}>{value.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>
          Ready to find your best loan?
        </h2>
        <p className={styles.ctaSubtitle}>
          Join 2,00,000+ Indians who trusted Finriseo
        </p>
        <Link href="/apply" className={styles.ctaBtn}>
          Apply Now — It&apos;s Free
        </Link>
      </section>

    </main>
  );
}

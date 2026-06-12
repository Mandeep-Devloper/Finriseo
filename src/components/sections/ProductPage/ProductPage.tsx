import Link from 'next/link';
import { CheckCircle, ArrowRight } from 'lucide-react';
import styles from './ProductPage.module.css';

interface ProductPageProps {
  title: string;
  subtitle: string;
  amount: string;
  rate: string;
  tenure: string;
  approval: string;
  features: string[];
  eligibility: string[];
  documents: string[];
  faqs: { q: string; a: string }[];
}

export default function ProductPage({
  title,
  subtitle,
  amount,
  rate,
  tenure,
  approval,
  features,
  eligibility,
  documents,
  faqs,
}: ProductPageProps) {
  return (
    <main className={styles.page}>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroGrid}>
          <div className={styles.heroLeft}>
            <h1 className={styles.heroTitle}>{title}</h1>
            <p className={styles.heroSubtitle}>{subtitle}</p>
            <Link href="/apply" className={styles.heroCta}>
              Apply Now — Free <ArrowRight size={18} />
            </Link>
            <p className={styles.heroNote}>
              ✓ No impact on CIBIL score &nbsp;&nbsp; ✓ 100% digital
            </p>
          </div>
          <div className={styles.heroRight}>
            <div className={styles.statsCard}>
              <div className={styles.statsCardTitle}>Quick Overview</div>
              {[
                { label: 'Max Loan Amount', value: amount },
                { label: 'Interest Rate', value: rate },
                { label: 'Tenure', value: tenure },
                { label: 'Approval Time', value: approval },
              ].map(s => (
                <div key={s.label} className={styles.statRow}>
                  <span className={styles.statLabel}>{s.label}</span>
                  <span className={styles.statValue}>{s.value}</span>
                </div>
              ))}
              <Link href="/apply" className={styles.statsCardCta}>
                Check My Eligibility
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={styles.featuresSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Key Features</h2>
          <div className={styles.featuresGrid}>
            {features.map(f => (
              <div key={f} className={styles.featureItem}>
                <CheckCircle size={18} className={styles.checkIcon} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Eligibility + Docs */}
      <section className={styles.twoColSection}>
        <div className={styles.container}>
          <div className={styles.twoColGrid}>
            <div className={styles.listCard}>
              <h2 className={styles.listCardTitle}>Eligibility Criteria</h2>
              <ul className={styles.list}>
                {eligibility.map(e => (
                  <li key={e} className={styles.listItem}>
                    <span className={styles.listDot} />{e}
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.listCard}>
              <h2 className={styles.listCardTitle}>Documents Required</h2>
              <ul className={styles.list}>
                {documents.map(d => (
                  <li key={d} className={styles.listItem}>
                    <span className={styles.listDot} />{d}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className={styles.faqSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <div className={styles.faqGrid}>
            {faqs.map(faq => (
              <details key={faq.q} className={styles.faqItem}>
                <summary className={styles.faqQuestion}>{faq.q}</summary>
                <p className={styles.faqAnswer}>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Ready to apply?</h2>
        <p className={styles.ctaSubtitle}>
          Get your offer in 10 minutes. No paperwork needed.
        </p>
        <Link href="/apply" className={styles.ctaBtn}>
          Apply Now — It&apos;s Free <ArrowRight size={18} />
        </Link>
      </section>
    </main>
  );
}

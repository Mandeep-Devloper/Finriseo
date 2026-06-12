'use client';
import Link from 'next/link';
import {
  User, Briefcase, Wallet, Home,
  GraduationCap, HeartPulse, ArrowRight
} from 'lucide-react';
import styles from './LoanProducts.module.css';

const PRODUCTS = [
  {
    icon: User,
    title: 'Personal Loan',
    desc: 'For medical, wedding, travel or any personal need.',
    amount: '₹5,00,000',
    rate: '10.49% p.a.',
    time: '10 min',
    href: '/personal-loan',
    tag: 'Most Popular',
  },
  {
    icon: Briefcase,
    title: 'Business Loan',
    desc: 'For SMEs, self-employed and growing businesses.',
    amount: '₹25,00,000',
    rate: '12% p.a.',
    time: 'Same day',
    href: '/business-loan',
    tag: null,
  },
  {
    icon: Wallet,
    title: 'Pocket Loan',
    desc: 'Quick small loans for everyday emergencies.',
    amount: '₹50,000',
    rate: '14% p.a.',
    time: '5 min',
    href: '/apply',
    tag: 'Instant',
  },
  {
    icon: Home,
    title: 'Home Loan',
    desc: 'Finance your dream home with the best rates.',
    amount: '₹1,00,00,000',
    rate: '8.5% p.a.',
    time: '24 hrs',
    href: '/apply',
    tag: null,
  },
  {
    icon: GraduationCap,
    title: 'Student Loan',
    desc: 'For higher studies in India and abroad.',
    amount: '₹40,00,000',
    rate: '8.5% p.a.',
    time: '24 hrs',
    href: '/education-loan',
    tag: null,
  },
  {
    icon: HeartPulse,
    title: 'Medical Loan',
    desc: 'Emergency medical funding when you need it most.',
    amount: '₹10,00,000',
    rate: '11% p.a.',
    time: '15 min',
    href: '/apply',
    tag: 'Emergency',
  },
];

export default function LoanProducts() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        {/* <p className={styles.eyebrow}>What We Offer</p> */}
        <h2 className={styles.sectionTitle}>Loan Products</h2>
        <p className={styles.sectionSubtitle}>
          Find the perfect financing option for your specific needs
        </p>
      </div>

      <div className={styles.grid}>
        {PRODUCTS.map((product) => {
          const Icon = product.icon;
          return (
            <div key={product.title} className={styles.card}>
              {product.tag && (
                <span className={styles.tag}>{product.tag}</span>
              )}
              <div className={styles.cardInner}>
                <div className={styles.cardTop}>
                  <div className={styles.iconWrap}>
                    <Icon size={22} strokeWidth={1.75} />
                  </div>
                  <h3 className={styles.cardTitle}>{product.title}</h3>
                  <p className={styles.cardDesc}>{product.desc}</p>
                </div>

                <div className={styles.cardStats}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Max Amount</span>
                    <span className={styles.statValue}>{product.amount}</span>
                  </div>
                  <div className={styles.statDivider} />
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Interest</span>
                    <span className={styles.statValue}>{product.rate}</span>
                  </div>
                  <div className={styles.statDivider} />
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Approval</span>
                    <span className={styles.statValue}>{product.time}</span>
                  </div>
                </div>

                <Link href={product.href} className={styles.cardCta}>
                  Apply Now <ArrowRight size={15} />
                </Link>
              </div>
              <div className={styles.cardGlow} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

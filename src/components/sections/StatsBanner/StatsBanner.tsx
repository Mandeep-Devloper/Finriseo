import React from 'react';
import styles from './StatsBanner.module.css';
import { AnimatedCounter } from '@/components/ui/Motion';

export default function StatsBanner() {
  return (
    <section className={styles.statsBanner} data-theme="dark">
      <div className="container">
        <div className={styles.statsGrid}>
          <article className={styles.statBox}>
            <strong className={styles.statValue}>
              <AnimatedCounter target={200000} suffix="+" />
            </strong>
            <span className={styles.statLabel}>Happy Customers</span>
          </article>
          <article className={styles.statBox}>
            <strong className={styles.statValue}>
              <AnimatedCounter target={500} prefix="₹" suffix=" Cr+" />
            </strong>
            <span className={styles.statLabel}>Loan Amount Disbursed</span>
          </article>
          <article className={styles.statBox}>
            <strong className={styles.statValue}>
              <AnimatedCounter target={50} suffix="+" />
            </strong>
            <span className={styles.statLabel}>NBFC Partners</span>
          </article>
          <article className={styles.statBox}>
            <strong className={styles.statValue}>
              <AnimatedCounter target={4.8} decimals={1} suffix="/5" />
            </strong>
            <span className={styles.statLabel}>Customer Rating</span>
          </article>
        </div>
      </div>
    </section>
  );
}

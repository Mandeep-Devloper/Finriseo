import React from 'react';
import { COMPANY } from '@/lib/constants';
import styles from './StatsBanner.module.css';
import { AnimatedCounter } from '@/components/ui/Motion';

export default function StatsBanner() {
  return (
    <section className={styles.statsBanner} data-theme="dark">
      <div className="container">
        <div className={styles.statsGrid}>
          <article className={styles.statBox}>
            <strong className={styles.statValue}>
              <AnimatedCounter target={200000} prefix="" suffix="+" />
            </strong>
            <span className={styles.statLabel}>Happy Customers</span>
          </article>
          <article className={styles.statBox}>
            <strong className={styles.statValue}>{COMPANY.stats.disbursed}</strong>
            <span className={styles.statLabel}>Loan Amount Disbursed</span>
          </article>
          <article className={styles.statBox}>
            <strong className={styles.statValue}>{COMPANY.stats.partners}</strong>
            <span className={styles.statLabel}>NBFC Partners</span>
          </article>
          <article className={styles.statBox}>
            <strong className={styles.statValue}>{COMPANY.stats.rating}/5</strong>
            <span className={styles.statLabel}>Customer Rating</span>
          </article>
        </div>
      </div>
    </section>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { calculateEMI, formatINR } from '@/lib/financial';
import styles from './EmiCalculator.module.css';

export default function EmiCalculator() {
  const [amount, setAmount] = useState<number>(500000);
  const [rate, setRate] = useState<number>(10.5);
  const [tenure, setTenure] = useState<number>(36);

  const emi = useMemo(() => calculateEMI(amount, rate, tenure), [amount, rate, tenure]);
  const totalPayable = emi * tenure;
  const totalInterest = totalPayable - amount;

  // SVG Donut calculation
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  // Principal vs Interest ratio
  const principalPercentage = totalPayable > 0 ? amount / totalPayable : 1;
  const principalArc = principalPercentage * circumference;

  return (
    <section className={`section ${styles.calculatorSection}`}>
      <div className="container">
        <header className="section-header">
          <h2 className="section-title">EMI Calculator</h2>
          <p className="section-subtitle">Plan your loan effectively. See your monthly outflows instantly.</p>
        </header>

        <div className={styles.calculatorBox}>
          <div className={styles.controlsCol}>
            
            <div className={styles.sliderGroup}>
              <div className={styles.sliderHeader}>
                <label className={styles.label}>Loan Amount</label>
                <div className={styles.valueBadge}>{formatINR(amount)}</div>
              </div>
              <input
                type="range"
                min={10000}
                max={1000000}
                step={10000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className={styles.rangeInput}
                style={{ '--progress': `${((amount - 10000) / (1000000 - 10000)) * 100}%` } as React.CSSProperties}
              />
              <div className={styles.sliderLimits}>
                <span>₹10k</span>
                <span>₹10L</span>
              </div>
            </div>

            <div className={styles.sliderGroup}>
              <div className={styles.sliderHeader}>
                <label className={styles.label}>Interest Rate (p.a.)</label>
                <div className={styles.valueBadge}>{rate}%</div>
              </div>
              <input
                type="range"
                min={8}
                max={36}
                step={0.5}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className={styles.rangeInput}
                style={{ '--progress': `${((rate - 8) / (36 - 8)) * 100}%` } as React.CSSProperties}
              />
              <div className={styles.sliderLimits}>
                <span>8%</span>
                <span>36%</span>
              </div>
            </div>

            <div className={styles.sliderGroup}>
              <div className={styles.sliderHeader}>
                <label className={styles.label}>Tenure (Months)</label>
                <div className={styles.valueBadge}>{tenure} Months</div>
              </div>
              <input
                type="range"
                min={3}
                max={60}
                step={1}
                value={tenure}
                onChange={(e) => setTenure(Number(e.target.value))}
                className={styles.rangeInput}
                style={{ '--progress': `${((tenure - 3) / (60 - 3)) * 100}%` } as React.CSSProperties}
              />
              <div className={styles.sliderLimits}>
                <span>3m</span>
                <span>60m</span>
              </div>
            </div>

          </div>

          <div className={styles.resultsCol}>
            <div className={styles.chartWrapper}>
              <svg viewBox="0 0 120 120" className={styles.donutChart}>
                {/* Background circle for Interest */}
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="var(--green-200)"
                  strokeWidth="16"
                />
                {/* Foreground circle for Principal */}
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="var(--emerald-500)"
                  strokeWidth="16"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - principalArc}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  className={styles.chartCircle}
                />
              </svg>
              <div className={styles.chartCenter}>
                <span className={styles.emiLabel}>Monthly EMI</span>
                <strong className={styles.emiValue}>{formatINR(Math.round(emi))}</strong>
              </div>
            </div>

            <div className={styles.breakdownBox}>
              <div className={styles.breakdownRow}>
                <div className={styles.breakdownLabel}>
                  <div className={styles.dotPrincipal}></div>
                  Principal Amount
                </div>
                <strong>{formatINR(amount)}</strong>
              </div>
              <div className={styles.breakdownRow}>
                <div className={styles.breakdownLabel}>
                  <div className={styles.dotInterest}></div>
                  Total Interest
                </div>
                <strong>{formatINR(Math.round(totalInterest))}</strong>
              </div>
              <div className={styles.breakdownTotal}>
                <span>Total Payable</span>
                <strong>{formatINR(Math.round(totalPayable))}</strong>
              </div>
            </div>

            <Link href="/apply" className={`btn btn--cta btn--lg ${styles.applyBtn}`}>
              Apply for this loan
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

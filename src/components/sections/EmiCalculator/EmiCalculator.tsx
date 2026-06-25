'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { calculateEMI, formatINR } from '@/lib/financial';
import styles from './EmiCalculator.module.css';

// Slider/input bounds — shared by the range sliders and the editable badges.
const AMOUNT_MIN = 10000, AMOUNT_MAX = 1000000;
const RATE_MIN = 8, RATE_MAX = 36;
const TENURE_MIN = 3, TENURE_MAX = 60;

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
const formatIndian = (n: number) => new Intl.NumberFormat('en-IN').format(n);

export default function EmiCalculator() {
  const [amount, setAmount] = useState<number>(500000);
  const [rate, setRate] = useState<number>(10.5);
  const [tenure, setTenure] = useState<number>(36);

  // Draft strings let the user freely type (incl. partial/empty values) in the
  // editable badges; the numeric state stays clamped for the slider + maths,
  // and the draft is normalized on blur.
  const [amountStr, setAmountStr] = useState('500000');
  const [rateStr, setRateStr] = useState('10.5');
  const [tenureStr, setTenureStr] = useState('36');

  // Which badge is being edited. While editing, the badge shows raw digits;
  // when idle it shows the polished formatted value (₹5,00,000 etc.).
  const [editing, setEditing] = useState<'amount' | 'rate' | 'tenure' | null>(null);

  // Loan amount (whole rupees)
  const onAmountInput = (raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, '');
    setAmountStr(cleaned);
    if (cleaned) setAmount(clamp(Number(cleaned), AMOUNT_MIN, AMOUNT_MAX));
  };
  const onAmountBlur = () => {
    const v = clamp(Number(amountStr || AMOUNT_MIN), AMOUNT_MIN, AMOUNT_MAX);
    setAmount(v); setAmountStr(String(v)); setEditing(null);
  };
  const onAmountSlide = (v: number) => { setAmount(v); setAmountStr(String(v)); };

  // Interest rate (allows one decimal)
  const onRateInput = (raw: string) => {
    const cleaned = raw.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    setRateStr(cleaned);
    if (cleaned && cleaned !== '.') setRate(clamp(Number(cleaned), RATE_MIN, RATE_MAX));
  };
  const onRateBlur = () => {
    const v = clamp(Number(rateStr || RATE_MIN), RATE_MIN, RATE_MAX);
    setRate(v); setRateStr(String(v)); setEditing(null);
  };
  const onRateSlide = (v: number) => { setRate(v); setRateStr(String(v)); };

  // Tenure (whole months)
  const onTenureInput = (raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, '');
    setTenureStr(cleaned);
    if (cleaned) setTenure(clamp(Number(cleaned), TENURE_MIN, TENURE_MAX));
  };
  const onTenureBlur = () => {
    const v = clamp(Number(tenureStr || TENURE_MIN), TENURE_MIN, TENURE_MAX);
    setTenure(v); setTenureStr(String(v)); setEditing(null);
  };
  const onTenureSlide = (v: number) => { setTenure(v); setTenureStr(String(v)); };

  // Values shown in the badges: formatted when idle, raw while editing.
  const amountDisplay = editing === 'amount' ? amountStr : formatIndian(amount);
  const rateDisplay = editing === 'rate' ? rateStr : String(rate);
  const tenureDisplay = editing === 'tenure' ? tenureStr : String(tenure);

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
                <label className={styles.label} htmlFor="emiAmount">Loan Amount</label>
                <div className={styles.valueBadge}>
                  <span className={styles.valuePrefix}>₹</span>
                  <input
                    id="emiAmount"
                    type="text"
                    inputMode="numeric"
                    className={styles.valueInput}
                    value={amountDisplay}
                    onChange={(e) => onAmountInput(e.target.value)}
                    onBlur={onAmountBlur}
                    onFocus={(e) => { setEditing('amount'); setAmountStr(String(amount)); e.target.select(); }}
                    style={{ width: `${Math.max(amountDisplay.length, 1)}ch` }}
                    aria-label="Loan amount in rupees"
                  />
                </div>
              </div>
              <input
                type="range"
                min={AMOUNT_MIN}
                max={AMOUNT_MAX}
                step={10000}
                value={amount}
                onChange={(e) => onAmountSlide(Number(e.target.value))}
                className={styles.rangeInput}
                style={{ '--progress': `${((amount - AMOUNT_MIN) / (AMOUNT_MAX - AMOUNT_MIN)) * 100}%` } as React.CSSProperties}
              />
              <div className={styles.sliderLimits}>
                <span>₹10k</span>
                <span>₹10L</span>
              </div>
            </div>

            <div className={styles.sliderGroup}>
              <div className={styles.sliderHeader}>
                <label className={styles.label} htmlFor="emiRate">Interest Rate (p.a.)</label>
                <div className={styles.valueBadge}>
                  <input
                    id="emiRate"
                    type="text"
                    inputMode="decimal"
                    className={styles.valueInput}
                    value={rateDisplay}
                    onChange={(e) => onRateInput(e.target.value)}
                    onBlur={onRateBlur}
                    onFocus={(e) => { setEditing('rate'); setRateStr(String(rate)); e.target.select(); }}
                    style={{ width: `${Math.max(rateDisplay.length, 1)}ch` }}
                    aria-label="Interest rate percent per annum"
                  />
                  <span className={`${styles.valueSuffix} ${styles.valueSuffixTight}`}>%</span>
                </div>
              </div>
              <input
                type="range"
                min={RATE_MIN}
                max={RATE_MAX}
                step={0.5}
                value={rate}
                onChange={(e) => onRateSlide(Number(e.target.value))}
                className={styles.rangeInput}
                style={{ '--progress': `${((rate - RATE_MIN) / (RATE_MAX - RATE_MIN)) * 100}%` } as React.CSSProperties}
              />
              <div className={styles.sliderLimits}>
                <span>8%</span>
                <span>36%</span>
              </div>
            </div>

            <div className={styles.sliderGroup}>
              <div className={styles.sliderHeader}>
                <label className={styles.label} htmlFor="emiTenure">Tenure (Months)</label>
                <div className={styles.valueBadge}>
                  <input
                    id="emiTenure"
                    type="text"
                    inputMode="numeric"
                    className={styles.valueInput}
                    value={tenureDisplay}
                    onChange={(e) => onTenureInput(e.target.value)}
                    onBlur={onTenureBlur}
                    onFocus={(e) => { setEditing('tenure'); setTenureStr(String(tenure)); e.target.select(); }}
                    style={{ width: `${Math.max(tenureDisplay.length, 1)}ch` }}
                    aria-label="Tenure in months"
                  />
                  <span className={styles.valueSuffix}>Months</span>
                </div>
              </div>
              <input
                type="range"
                min={TENURE_MIN}
                max={TENURE_MAX}
                step={1}
                value={tenure}
                onChange={(e) => onTenureSlide(Number(e.target.value))}
                className={styles.rangeInput}
                style={{ '--progress': `${((tenure - TENURE_MIN) / (TENURE_MAX - TENURE_MIN)) * 100}%` } as React.CSSProperties}
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

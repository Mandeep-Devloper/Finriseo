import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import styles from './page.module.css';

const EmiCalculator = dynamic(
  () => import('@/components/sections/EmiCalculator/EmiCalculator'),
  {
    loading: () => (
      <div style={{
        minHeight: 500, display: 'flex',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{
          width: 40, height: 40, border: '3px solid #dcfce7',
          borderTop: '3px solid #16a34a', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
      </div>
    )
  }
);

export const metadata: Metadata = {
  title: 'Free EMI Calculator | Plan Your Loan | Finriseo',
  description: 'Calculate your exact EMI instantly. Plan personal, business or education loan repayment with our free calculator.',
};

export default function EmiCalculatorPage() {
  return (
    <main className={styles.page}>

      {/* Hero Header */}
      <div className={styles.pageHero}>
        <div className={styles.pageHeroInner}>
          {/* <span className={styles.eyebrow}>Free Tool</span> */}
          <h1 className={styles.pageTitle}>EMI Calculator</h1>
          <p className={styles.pageSubtitle}>
            Plan your loan repayment before you apply.
            See exact monthly installments instantly.
          </p>
        </div>
      </div>

      {/* Calculator */}
      <div className={styles.calcWrapper}>
        <EmiCalculator />
      </div>

      {/* SEO Content */}
      <section className={styles.seoSection}>
        <div className={styles.seoGrid}>
          <div className={styles.seoCard}>
            <h2>What is EMI?</h2>
            <p>
              EMI (Equated Monthly Instalment) is the fixed amount
              you pay every month to repay your loan. It includes
              both principal and interest components.
            </p>
            <div className={styles.formula}>
              EMI = P × r × (1+r)ⁿ ÷ ((1+r)ⁿ - 1)
            </div>
            <p className={styles.formulaNote}>
              P = Principal &nbsp;|&nbsp; r = Monthly rate &nbsp;|&nbsp; n = Tenure (months)
            </p>
          </div>

          <div className={styles.seoCard}>
            <h2>Tips to Reduce EMI</h2>
            <ul className={styles.tipList}>
              {[
                'Higher down payment reduces principal',
                'Better CIBIL score gets lower rates',
                'Compare lenders before applying',
                'Longer tenure = lower EMI (more interest)',
                'Prepay when possible to save interest',
              ].map(tip => (
                <li key={tip} className={styles.tipItem}>
                  <span className={styles.tipDot} />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sample EMI Table */}
        <div className={styles.tableWrap}>
          <h2 className={styles.tableTitle}>
            Sample EMI for ₹3,00,000 Loan
          </h2>
          <div className={styles.tableScroll}>
            <table className={styles.emiTable}>
              <thead>
                <tr>
                  <th>Interest Rate</th>
                  <th>12 Months</th>
                  <th>24 Months</th>
                  <th>36 Months</th>
                  <th>48 Months</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { rate: '10.49%', m12: '₹26,467', m24: '₹13,844', m36: '₹9,698', m48: '₹7,621' },
                  { rate: '12.00%', m12: '₹26,614', m24: '₹14,113', m36: '₹9,964', m48: '₹7,881' },
                  { rate: '15.00%', m12: '₹27,039', m24: '₹14,524', m36: '₹10,399', m48: '₹8,337' },
                  { rate: '18.00%', m12: '₹27,472', m24: '₹14,938', m36: '₹10,839', m48: '₹8,806' },
                ].map((row, i) => (
                  <tr key={i}>
                    <td className={styles.rateCell}>{row.rate}</td>
                    <td>{row.m12}</td>
                    <td>{row.m24}</td>
                    <td className={styles.highlight}>{row.m36}</td>
                    <td>{row.m48}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

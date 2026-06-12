import Link from 'next/link';
import Image from 'next/image';
import { COMPANY } from '@/lib/constants';

import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer} role="contentinfo" data-theme="dark">
      <div className={`container ${styles.container}`}>
        <div className={styles.topRow}>
          <Link href="/" className={styles.logo} aria-label={`${COMPANY.name} Home`}>
            {/* The filter in CSS will invert the logo to white if it's black */}
            <Image
              src="/Finriseo.svg"
              alt="Finriseo logo"
              width={124}
              height={32}
              className={styles.footerLogo}
              style={{ objectFit: 'contain' }}
            />
          </Link>
          <p className={styles.tagline}>{COMPANY.tagline}</p>
        </div>

        <div className={styles.grid}>
          {/* Column 1: Company description + social links */}
          <div className={styles.column}>
            <p className={styles.description}>{COMPANY.description}</p>
            <div className={styles.socialLinks}>
              <a href={COMPANY.social.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className={styles.socialLink}>
                LinkedIn
              </a>
              <a href={COMPANY.social.twitter} target="_blank" rel="noopener noreferrer" aria-label="Twitter" className={styles.socialLink}>
                Twitter
              </a>
            </div>
          </div>

          {/* Column 2: Loan Products */}
          <div className={styles.column}>
            <h3 className={styles.columnTitle}>Loan Products</h3>
            <ul className={styles.linkList}>
              <li><Link href="/personal-loan" className={styles.link}>Personal Loan</Link></li>
              <li><Link href="/business-loan" className={styles.link}>Business Loan</Link></li>
              <li><Link href="/education-loan" className={styles.link}>Education Loan</Link></li>
              <li><Link href="/emi-calculator" className={styles.link}>EMI Calculator</Link></li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div className={styles.column}>
            <h3 className={styles.columnTitle}>Company</h3>
            <ul className={styles.linkList}>
              <li><Link href="/about" className={styles.link}>About Us</Link></li>
              <li><Link href="/contact" className={styles.link}>Contact</Link></li>
              <li><Link href="/grievance" className={styles.link}>Grievance Redressal</Link></li>
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div className={styles.column}>
            <h3 className={styles.columnTitle}>Legal</h3>
            <ul className={styles.linkList}>
              <li><Link href="/privacy-policy" className={styles.link}>Privacy Policy</Link></li>
              <li><Link href="/terms" className={styles.link}>Terms & Conditions</Link></li>
            </ul>
          </div>
        </div>

        {/* Disclaimer */}
        <div className={styles.disclaimer}>
          <p>
            Finriseo is a loan comparison platform. We are not a bank or NBFC. Loans are subject to lender approval and eligibility criteria.
          </p>
        </div>

        {/* Bottom Bar */}
        <div className={styles.bottomBar}>
          <p className={styles.copyright}>
            &copy; {new Date().getFullYear()} {COMPANY.legalName}. All rights reserved.
          </p>
          <p className={styles.cin}>
            CIN: {COMPANY.cin}
          </p>
        </div>
      </div>
    </footer>
  );
}

import React from 'react';
import styles from './Partners.module.css';

const PARTNERS = [
  'HDFC Bank', 'ICICI Bank', 'Axis Bank', 
  'Kotak Mahindra', 'Bajaj Finance', 'Tata Capital',
  'Aditya Birla', 'Fullerton India', 'IndusInd Bank',
  'Yes Bank', 'IDFC First', 'Piramal Finance'
];

const doubled = [...PARTNERS, ...PARTNERS];

export default function Partners() {
  return (
    <section className={styles.section}>
      <div className="container">
        <header className="section-header">
          <h2 className="section-title">Our Lending Partners</h2>
          <p className="section-subtitle">Verified & RBI-registered institutions</p>
        </header>
        <div className={styles.marqueeWrapper}>
          <div className={styles.marqueeTrack}>
            {doubled.map((partner, index) => (
              <div key={index} className={styles.partnerPill}>
                {partner}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

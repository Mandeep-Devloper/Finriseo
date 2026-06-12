'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Faq.module.css';
import { FadeIn } from '@/components/ui/Motion';

const FAQ_DATA = [
  { question: 'What is Finriseo?', answer: 'Finriseo is India\'s trusted loan comparison platform. We are not a direct lender, but we connect you with 50+ RBI-registered NBFCs and Banks to help you find the best loan offers.' },
  { question: 'Is my data safe?', answer: 'Absolutely. We use bank-grade 256-bit encryption and are fully compliant with the DPDP Act 2023 and RBI data localization guidelines. Your data is never sold to unauthorized third parties.' },
  { question: 'Does checking eligibility affect my CIBIL score?', answer: 'No. Checking your eligibility on Finriseo counts as a "soft inquiry" which has zero impact on your CIBIL score.' },
  { question: 'How quickly can I get a loan?', answer: 'With our 100% digital process, you can get in-principle approval in as little as 10 minutes, and final disbursement often happens on the very same day.' },
  { question: 'What is the minimum credit score required?', answer: 'While a CIBIL score of 650+ is generally preferred for the best rates, eligibility criteria vary heavily across our 50+ lending partners. We match you with lenders suited to your specific profile.' },
  { question: 'Are there any hidden charges?', answer: 'No. We pride ourselves on transparency. All processing fees, interest rates, and foreclosure charges are displayed upfront before you sign any agreement.' },
  { question: 'What documents do I need?', answer: 'Typically, you will need your PAN card, Aadhaar card (for e-KYC), last 3 months\' salary slips, and a 6-month bank statement showing salary credits.' },
  { question: 'Can I apply for multiple loan types?', answer: 'Yes, our platform supports applications for Personal Loans, Business Loans, and Education Loans based on your requirements.' }
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleAccordion = (index: number) => {
    setOpenIndex(prev => (prev === index ? null : index));
  };

  return (
    <section className={`section section--light ${styles.faqSection}`}>
      <div className="container">
        <header className="section-header">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">Everything you need to know about applying for a loan with Finriseo.</p>
        </header>

        <div className={styles.faqList}>
          {FAQ_DATA.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <FadeIn 
                key={index} 
                delay={index * 0.05}
                className={`${styles.faqItem} ${isOpen ? styles.isOpen : ''}`}
              >
                <button 
                  className={styles.faqHeader} 
                  onClick={() => toggleAccordion(index)}
                  aria-expanded={isOpen}
                >
                  <span className={styles.question}>{faq.question}</span>
                  <ChevronDown className={styles.icon} size={20} />
                </button>
                <div 
                  className={styles.faqContent}
                  aria-hidden={!isOpen}
                >
                  <div className={styles.answerWrapper}>
                    <p className={styles.answer}>{faq.answer}</p>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

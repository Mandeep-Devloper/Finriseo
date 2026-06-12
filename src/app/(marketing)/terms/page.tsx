import React from 'react';
import type { Metadata } from 'next';
import { COMPANY } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: `Terms and Conditions for using ${COMPANY.name}, India's trusted loan comparison platform.`,
};

export default function TermsPage() {
  return (
    <main className="section">
      <div className="container">
        <header className="section-header">
          <h1 className="section-title">Terms & Conditions</h1>
          <p className="section-subtitle">Last Updated: {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
        </header>

        <div className="prose">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using the {COMPANY.name} website, operated by {COMPANY.legalName}, you agree to be bound by these Terms & Conditions.
          </p>

          <h2>2. Nature of Service (RBI Compliance Disclaimer)</h2>
          <p>
            <strong>{COMPANY.name} is a Digital Lending Application (DLA) / Direct Selling Agent (DSA) and a loan comparison platform. We are NOT a bank or a Non-Banking Financial Company (NBFC) and we do not lend our own funds.</strong> 
            We connect borrowers with RBI-registered lending partners. The final decision to approve, disburse, or reject a loan rests entirely with the respective lender based on their credit policies.
          </p>

          <h2>3. User Obligations</h2>
          <p>As a user of our platform, you agree to:</p>
          <ul>
            <li>Provide accurate, current, and complete information during the application process.</li>
            <li>Not use the platform for any fraudulent or illegal activities.</li>
            <li>Authorize {COMPANY.name} and its lending partners to fetch your credit report from Credit Information Bureaus (e.g., CIBIL, Experian) for assessing eligibility.</li>
          </ul>

          <h2>4. Comparison Service</h2>
          <p>
            The loan offers, interest rates, EMIs, and fees displayed on {COMPANY.name} are indicative and based on data provided by our lending partners. The final terms of your loan will be determined by the lender and documented in the loan agreement you sign with them.
          </p>

          <h2>5. Limitation of Liability</h2>
          <p>
            {COMPANY.name} shall not be liable for any indirect, incidental, or consequential damages arising out of your use of our platform. We are not responsible for any disputes arising between you and the lending partner regarding loan disbursal, recovery, or interest rates.
          </p>

          <h2>6. Governing Law</h2>
          <p>
            These terms are governed by the laws of India. Any disputes arising out of your use of {COMPANY.name} shall be subject to the exclusive jurisdiction of the courts located at our registered office jurisdiction.
          </p>
        </div>
      </div>
    </main>
  );
}

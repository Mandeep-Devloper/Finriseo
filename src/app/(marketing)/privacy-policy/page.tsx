import React from 'react';
import type { Metadata } from 'next';
import { COMPANY } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `Privacy Policy for ${COMPANY.name} — Data collection, usage, and storage practices in compliance with Indian regulations.`,
};

export default function PrivacyPolicyPage() {
  return (
    <main className="section">
      <div className="container">
        <header className="section-header">
          <h1 className="section-title">Privacy Policy</h1>
          <p className="section-subtitle">Last Updated: {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
        </header>
        
        <div className="prose">
          <h2>1. Introduction</h2>
          <p>
            Welcome to {COMPANY.name} (operated by {COMPANY.legalName}). We respect your privacy and are committed to protecting your personal data in compliance with the Digital Personal Data Protection (DPDP) Act 2023 and applicable Reserve Bank of India (RBI) guidelines. This policy explains how we collect, use, and store your information.
          </p>

          <h2>2. Data Collection</h2>
          <p>As a loan comparison and origination platform, we collect:</p>
          <ul>
            <li><strong>Identity Data:</strong> Name, Date of Birth, PAN, Aadhaar details.</li>
            <li><strong>Contact Data:</strong> Mobile number, email address, residential address.</li>
            <li><strong>Financial Data:</strong> Income details, employment status, bank statements.</li>
            <li><strong>Technical Data:</strong> IP address, device information, and cookies.</li>
          </ul>

          <h2>3. Usage of Data</h2>
          <p>We use your data strictly for the following purposes:</p>
          <ul>
            <li>Verifying your identity and fetching your credit profile.</li>
            <li>Matching you with appropriate loan offers from our lending partners (RBI-registered banks and NBFCs).</li>
            <li>Facilitating the loan application process with the chosen lender.</li>
            <li>Communicating with you regarding your application status.</li>
          </ul>

          <h2>4. Data Storage & Security</h2>
          <p>
            Your data is encrypted both in transit and at rest using industry-standard protocols. We store all user data on secure servers located exclusively within India, in adherence to data localization mandates.
          </p>

          <h2>5. Cookie Policy</h2>
          <p>
            We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. You can manage your cookie preferences through your browser settings.
          </p>

          <h2>6. User Rights</h2>
          <p>Under the DPDP Act, you have the right to:</p>
          <ul>
            <li>Access your personal data held by us.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request erasure of your data (subject to regulatory retention requirements).</li>
            <li>Withdraw your consent for processing at any time.</li>
          </ul>

          <h2>7. Contact the Data Protection Officer (DPO)</h2>
          <p>
            If you have any questions about this Privacy Policy or wish to exercise your rights, please contact our Data Protection Officer at:
          </p>
          <address>
            <strong>Email:</strong> <a href={`mailto:${COMPANY.dpoEmail}`}>{COMPANY.dpoEmail}</a><br />
            <strong>Address:</strong> {COMPANY.address?.full || 'Registered Office Address'}
          </address>
        </div>
      </div>
    </main>
  );
}

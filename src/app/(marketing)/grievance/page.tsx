import React from 'react';
import type { Metadata } from 'next';
import { COMPANY } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Grievance Redressal',
  description: `Grievance Redressal Mechanism for ${COMPANY.name} as per RBI guidelines.`,
};

export default function GrievancePage() {
  return (
    <main className="section">
      <div className="container">
        <header className="section-header">
          <h1 className="section-title">Grievance Redressal Mechanism</h1>
          <p className="section-subtitle">We are committed to resolving your queries and complaints promptly.</p>
        </header>

        <div className="prose">
          <h2>1. Objective</h2>
          <p>
            At {COMPANY.name}, customer satisfaction is our top priority. This Grievance Redressal Mechanism has been formulated in accordance with the guidelines issued by the Reserve Bank of India (RBI) for Digital Lending Platforms.
          </p>

          <h2>2. Level 1: Customer Support</h2>
          <p>
            If you have any queries, concerns, or complaints regarding our services, loan comparisons, or data usage, please reach out to our primary customer support team first.
          </p>
          <ul>
            <li><strong>Email:</strong> <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></li>
            <li><strong>Resolution Time:</strong> We aim to resolve Level 1 queries within 7 working days.</li>
          </ul>

          <h2>3. Level 2: Grievance Redressal Officer</h2>
          <p>
            If your complaint is not resolved within 7 days, or if you are dissatisfied with the resolution provided at Level 1, you may escalate the matter to our appointed Grievance Redressal Officer.
          </p>
          <blockquote>
            <strong>Name:</strong> {COMPANY.grievanceOfficer?.name}<br />
            <strong>Email:</strong> <a href={`mailto:${COMPANY.grievanceOfficer?.email}`}>{COMPANY.grievanceOfficer?.email}</a><br />
            <strong>Phone:</strong> {COMPANY.grievanceOfficer?.phone}
          </blockquote>
          <p>
            <em>Note: Our Grievance Officer will acknowledge your complaint within 24-48 hours and provide a final resolution within a maximum of 30 days from the date of initial complaint.</em>
          </p>

          <h2>4. Level 3: Escalation to Lending Partner</h2>
          <p>
            If your grievance pertains directly to the loan product, interest rate, recovery agent behavior, or terms of the loan agreement, the complaint must be addressed by the respective RBI-registered NBFC or Bank that disbursed the loan. We will assist you in routing your complaint to the nodal officer of the respective lender.
          </p>

          <h2>5. Level 4: Escalation to RBI Ombudsman</h2>
          <p>
            If the grievance remains unresolved for a period of 30 days, or if you are not satisfied with the response provided by {COMPANY.name} or our lending partner, you may escalate the complaint to the RBI Ombudsman under the Integrated Ombudsman Scheme, 2021.
          </p>
          <p>
            Complaints can be filed online through the Complaint Management System (CMS) portal of the RBI at: <a href="https://cms.rbi.org.in" target="_blank" rel="noopener noreferrer">https://cms.rbi.org.in</a>
          </p>
        </div>
      </div>
    </main>
  );
}

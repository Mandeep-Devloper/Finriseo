import type { Metadata } from 'next';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import ContactForm from './ContactForm';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Contact Finriseo | Get in Touch',
  description: 'Contact our loan experts. Available Monday to Saturday, 9AM to 7PM IST.',
};

const CONTACT_INFO = [
  {
    icon: Phone,
    label: 'Phone',
    value: '1800-123-456',
    sub: 'Toll free',
    href: 'tel:+911800123456',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'support@finriseo.com',
    sub: 'We reply within 24 hours',
    href: 'mailto:support@finriseo.com',
  },
  {
    icon: MapPin,
    label: 'Office',
    value: '301, FinServe Tower, BKC',
    sub: 'Mumbai, Maharashtra 400051',
    href: null,
  },
  {
    icon: Clock,
    label: 'Working Hours',
    value: 'Mon – Sat, 9AM – 7PM',
    sub: 'IST (Indian Standard Time)',
    href: null,
  },
];

export default function ContactPage() {
  return (
    <main className={styles.page}>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          {/* <span className={styles.eyebrow}>Get in Touch</span> */}
          <h1 className={styles.heroTitle}>Contact Us</h1>
          <p className={styles.heroSubtitle}>
            Our loan experts are here to help.
            Reach out anytime.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className={styles.mainSection}>
        <div className={styles.grid}>

          {/* Left — Contact Info */}
          <div className={styles.infoCol}>
            <h2 className={styles.infoTitle}>We would love to hear from you</h2>
            <p className={styles.infoSubtitle}>
              Have a question about a loan? Need help with your application?
              Our team is ready to assist.
            </p>

            <div className={styles.contactCards}>
              {CONTACT_INFO.map(item => {
                const Icon = item.icon;
                const content = (
                  <div key={item.label} className={styles.contactCard}>
                    <div className={styles.contactIconWrap}>
                      <Icon size={20} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className={styles.contactLabel}>{item.label}</p>
                      <p className={styles.contactValue}>{item.value}</p>
                      <p className={styles.contactSub}>{item.sub}</p>
                    </div>
                  </div>
                );
                return item.href ? (
                  <a key={item.label} href={item.href} className={styles.contactCardLink}>
                    {content}
                  </a>
                ) : (
                  <div key={item.label}>{content}</div>
                );
              })}
            </div>
          </div>

          {/* Right — Form */}
          <div className={styles.formCol}>
            <ContactForm />
          </div>
        </div>
      </section>
    </main>
  );
}

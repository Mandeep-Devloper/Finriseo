import {
  ShieldCheck, Zap, IndianRupee,
  Lock, FileX, Headphones
} from 'lucide-react';
import styles from './WhyChooseUs.module.css';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'RBI Registered Partners',
    desc: 'All our NBFC partners are verified and RBI-registered for your safety.',
  },
  {
    icon: Zap,
    title: 'Instant Approval',
    desc: 'Get loan approval in as little as 10 minutes from application.',
  },
  {
    icon: IndianRupee,
    title: 'Best Rates Guaranteed',
    desc: 'We compare verified lenders to find your lowest interest rate.',
  },
  {
    icon: Lock,
    title: '100% Secure',
    desc: 'Bank-grade encryption protects your data at every step.',
  },
  {
    icon: FileX,
    title: 'Zero Paperwork',
    desc: '100% digital process, no physical documents needed.',
  },
  {
    icon: Headphones,
    title: 'Dedicated Support',
    desc: 'Expert loan advisors available Monday to Saturday, 9AM-7PM.',
  },
];

export default function WhyChooseUs() {
  return (
    <section className={styles.section} data-theme="dark">
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          {/* <p className={styles.eyebrow}>Why Finriseo</p> */}
          <h2 className={styles.sectionTitle}>Why Choose Finriseo?</h2>
          <p className={styles.sectionSubtitle}>
            We make borrowing simple, transparent, and fast
          </p>
        </div>

        <div className={styles.grid}>
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className={styles.card}>
                <div className={styles.cardTopLine} />
                <div className={styles.iconWrap}>
                  <Icon size={22} strokeWidth={1.75} />
                </div>
                <h3 className={styles.cardTitle}>{feature.title}</h3>
                <p className={styles.cardDesc}>{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

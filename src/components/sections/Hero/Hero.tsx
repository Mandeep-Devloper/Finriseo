'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GitCompare, ClipboardCheck, Zap, FileX, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { basicInfoSchema } from '@/lib/validations';
import { useApplicationStore } from '@/store/applicationStore';
import styles from './Hero.module.css';

const WORDS = [
  'get approved.',
  'मंज़ूर होते हैं।',
  'ਪਾਸ ਹੁੰਦੇ ਨੇ।',
  'मंजूर होतात.',
  'મંજૂર થાય છે.',
  'ఆమోదించబడతాయి.',
  'அனுமதிக்கப்படும்.',
];

type FormData = z.infer<typeof basicInfoSchema>;

export default function Hero() {
  const router = useRouter();
  const updateData = useApplicationStore((state) => state.updateData);
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setShow(false);
      setTimeout(() => {
        setIndex(prev => (prev + 1) % WORDS.length);
        setShow(true);
      }, 350);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      fullName: '',
      mobile: '',
      // Consent is implicit via the "By proceeding…" disclaimer shown below the
      // form. step1Schema requires consent===true, so without this default the
      // landing-page submit silently fails validation and never navigates.
      consent: true,
    }
  });

  const fullNameValue = watch('fullName') || '';
  const mobileValue = watch('mobile') || '';

  const isNameValid = fullNameValue.trim().length > 2;
  const isMobileValid = /^[6-9]\d{9}$/.test(mobileValue);

  const onSubmit = (data: FormData) => {
    updateData({ fullName: data.fullName, mobile: data.mobile });
    router.push('/apply');
  };

  return (
    <section className={styles.hero} data-theme="dark">
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.gridOverlay} />

      <div className={styles.heroGrid}>
        {/* LEFT */}
        <div className={styles.heroLeft}>

          {/* Trust badge */}
          {/* <div className={styles.trustBadge}>
            <span className={styles.trustDotOuter} />
            Verified NBFC Partners — 100% Secure
          </div> */}

          {/* Heading */}
          <h1 className={styles.heroTitle}>
            Loans that actually
            <span className={styles.rotatingLine}>
              <span
                className={styles.rotatingWord}
                style={{
                  opacity: show ? 1 : 0,
                  transform: show ? 'translateY(0)' : 'translateY(16px)'
                }}
              >
                {WORDS[index]}
              </span>
            </span>
          </h1>

          {/* Subtitle */}
          <p className={styles.heroSubtitle}>
            Compare personal, business, and education loans
            from India&apos;s top RBI-registered NBFCs.
            One application, multiple offers.
          </p>

          {/* 4 Badges */}
          <div className={styles.badgeStrip}>
            {[
              { icon: <GitCompare size={18} />, title: 'Compare Lenders', desc: 'Verified NBFCs' },
              { icon: <ClipboardCheck size={18} />, title: 'Check Eligibility', desc: 'Instant result' },
              { icon: <Zap size={18} />, title: 'Digital Journey', desc: '100% online' },
              { icon: <FileX size={18} />, title: 'Zero Paperwork', desc: 'No physical docs' },
            ].map(b => (
              <div key={b.title} className={styles.badge}>
                <span className={styles.badgeIcon}>{b.icon}</span>
                <div>
                  <div className={styles.badgeTitle}>{b.title}</div>
                  <div className={styles.badgeDesc}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — FORM */}
        <div className={styles.heroRight}>
          <div className={styles.formCard}>
            {/* <div className={styles.trustBadgeInForm}>
              <span className={styles.trustDot} />
              RBI Registered NBFC Partners — 100% Secure
            </div> */}

            <h2 className={styles.formCardTitle}>Get Personalized<br></br>Loan Offers</h2>
            <p className={styles.formCardSubtitle}>
              Get a Loan up to ₹10,00,000 in Minutes
            </p>

            <form onSubmit={handleSubmit(onSubmit)}>
              <div style={{ marginBottom: 16 }}>
                <label className={styles.formLabel}>Full Name</label>
                <input
                  {...register('fullName')}
                  className={`${styles.formInput} ${isNameValid ? styles.validInput : ''}`}
                  placeholder="As per PAN card"
                />
                {errors.fullName && (
                  <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: 4 }}>
                    {errors.fullName.message}
                  </p>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className={styles.formLabel}>Mobile Number</label>
                <div className={`${styles.mobilePrefix} ${isMobileValid ? styles.validPrefix : ''}`}>
                  <span className={styles.prefixText}>🇮🇳 +91</span>
                  <input
                    {...register('mobile')}
                    className={styles.mobileInput}
                    placeholder="9876543210"
                    maxLength={10}
                    inputMode="numeric"
                  />
                </div>
                {errors.mobile && (
                  <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: 4 }}>
                    {errors.mobile.message}
                  </p>
                )}
              </div>

              <button type="submit" className={styles.submitBtn}>
                Check My Eligibility <ArrowRight size={18} />
              </button>
            </form>

            <p className={styles.formDisclaimer}>
              By proceeding, you agree to our{' '}
              <Link href="/terms">Terms & Conditions</Link>.
              This will not affect your CIBIL score.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

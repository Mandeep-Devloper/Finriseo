'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import styles from './ScrollSteps.module.css';

// width/height reflect the real pixel dimensions of the source files so
// Next.js reserves the correct aspect box (no layout shift, no distortion).
const STEPS = [
  {
    title: 'Register & Fill Basic Details',
    desc: 'Sign up with your mobile number and enter your employment and income details to check eligible loan offers.',
    image: '/point1.webp',
    width: 1200,
    height: 900,
  },
  {
    title: 'Verify PAN & Compare Loans',
    desc: 'Verify your PAN details and compare personalized loan offers from trusted lenders in one place.',
    image: '/step2.webp',
    width: 760,
    height: 570,
  },
  {
    title: 'Get Your Loan',
    desc: 'Choose your preferred lender, complete the final process, and get your loan directly in your bank account.',
    image: '/step3.webp',
    width: 760,
    height: 507,
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export default function ScrollSteps() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    if (latest < 0.33) setActiveStep(0);
    else if (latest < 0.66) setActiveStep(1);
    else setActiveStep(2);
  });

  return (
    <section className={styles.scrollSection} ref={containerRef}>
      <div className={styles.stickyContainer}>
        <div className={`container ${styles.innerContainer}`}>
          <div className={styles.contentGrid}>
            <div className={styles.leftColumn}>
              <header className={styles.header}>
                <h2 className="section-title" style={{ textAlign: 'left' }}>
                  How Finriseo Works
                </h2>
                <p className="section-subtitle" style={{ textAlign: 'left', margin: '0' }}>
                  Get your loan in 3 simple steps
                </p>
              </header>

              <div className={styles.stepsList}>
                {STEPS.map((step, index) => {
                  const isActive = index === activeStep;
                  const isPast = index < activeStep;

                  return (
                    <div
                      key={index}
                      className={`${styles.stepItem} ${isActive ? styles.active : ''} ${isPast ? styles.past : ''}`}
                      onClick={() => setActiveStep(index)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className={styles.stepIndicator}>
                        <div className={styles.stepNumber}>{index + 1}</div>
                      </div>
                      <div className={styles.stepText}>
                        <h3 className={styles.stepTitle}>{step.title}</h3>
                        <p
                          className={styles.stepDesc}
                          style={{
                            opacity: isActive ? 1 : 0,
                            transform: isActive ? 'translateY(0)' : 'translateY(8px)',
                            maxHeight: isActive ? '200px' : '0px',
                            overflow: 'hidden',
                            transition: 'opacity 300ms ease-in-out, transform 300ms ease-in-out, max-height 300ms ease-in-out, margin-top 300ms ease-in-out',
                            marginTop: isActive ? '8px' : '0px',
                            marginBottom: 0,
                          }}
                        >
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.rightColumn}>
              {/* All three visuals are mounted and preloaded up front (they
                  total ~124 KB), then cross-faded on already-decoded images —
                  so switching steps is a smooth opacity/scale transition with
                  no fetch-and-pop-in. */}
              <div className={styles.visualStage}>
                {STEPS.map((step, index) => {
                  const isActive = index === activeStep;
                  return (
                    <motion.div
                      key={step.image}
                      className={styles.visualLayer}
                      initial={false}
                      animate={{
                        opacity: isActive ? 1 : 0,
                        scale: isActive ? 1 : 0.94,
                        y: isActive ? 0 : 24,
                      }}
                      transition={{ duration: 0.6, ease: EASE }}
                      aria-hidden={!isActive}
                    >
                      <Image
                        src={step.image}
                        alt={step.title}
                        width={step.width}
                        height={step.height}
                        className={styles.stepImage}
                        sizes="(max-width: 768px) 92vw, 560px"
                        quality={85}
                        priority
                      />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import {
  motion,
  useScroll,
  useMotionValueEvent,
  useTransform,
  AnimatePresence,
} from 'framer-motion';
import styles from './ScrollSteps.module.css';

const STEPS = [
  {
    title: 'Register & Fill Basic Details',
    desc: 'Sign up with your mobile number and enter your employment and income details to check eligible loan offers.',
    image: '/point1.svg',
    width: 1448,
    height: 1086,
    unoptimized: true,
  },
  {
    title: 'Verify PAN & Compare Loans',
    desc: 'Verify your PAN details and compare personalized loan offers from trusted lenders in one place.',
    image: '/step2.png',
    width: 600,
    height: 584,
  },
  {
    title: 'Get Your Loan',
    desc: 'Choose your preferred lender, complete the final process, and get your loan directly in your bank account.',
    image: '/step-funded.webp',
    width: 600,
    height: 600,
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

  const step1Y = useTransform(scrollYProgress, [0, 0.33], [56, 0]);
  const step1Scale = useTransform(scrollYProgress, [0, 0.33], [0.9, 1]);
  const step1Opacity = useTransform(scrollYProgress, [0, 0.12, 0.28, 0.36], [0.5, 1, 1, 0]);

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    if (latest < 0.33) setActiveStep(0);
    else if (latest < 0.66) setActiveStep(1);
    else setActiveStep(2);
  });

  const currentStep = STEPS[activeStep];

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
                    >
                      <div className={styles.stepIndicator}>
                        <div className={styles.stepNumber}>{index + 1}</div>
                      </div>
                      <div className={styles.stepText}>
                        <h3 className={styles.stepTitle}>{step.title}</h3>
                        <p className={styles.stepDesc}>{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.rightColumn}>
              <AnimatePresence mode="wait">
                {activeStep === 0 ? (
                  <motion.div
                    key="step-visual-0"
                    className={styles.visualStage}
                    style={{ y: step1Y, scale: step1Scale, opacity: step1Opacity }}
                    exit={{ opacity: 0, y: -28, scale: 0.94 }}
                    transition={{ duration: 0.55, ease: EASE }}
                  >
                    <Image
                      src={STEPS[0].image}
                      alt={STEPS[0].title}
                      width={STEPS[0].width}
                      height={STEPS[0].height}
                      className={styles.stepImage}
                      sizes="(max-width: 768px) 92vw, 560px"
                      unoptimized
                      priority
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key={`step-visual-${activeStep}`}
                    className={`${styles.visualStage} ${styles.visualStageLegacy}`}
                    initial={{ opacity: 0, y: 28, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.97 }}
                    transition={{ duration: 0.5, ease: EASE }}
                  >
                    <Image
                      src={currentStep.image}
                      alt={currentStep.title}
                      width={currentStep.width}
                      height={currentStep.height}
                      className={styles.stepImage}
                      sizes="(max-width: 768px) 92vw, 560px"
                      unoptimized={currentStep.unoptimized}
                      {...(currentStep.unoptimized ? {} : { quality: 85 })}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

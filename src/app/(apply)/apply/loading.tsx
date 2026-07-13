import React from 'react';
import styles from '@/components/layout/ApplyLayout/ApplyLayout.module.css';

// Skeleton mirroring the CURRENT ApplyLayout (left brand panel + phone-frame
// card). The previous skeleton referenced classes from a long-gone layout
// (rightContent/progressContainer/stepsRow) and rendered unstyled.
export default function ApplyLoading() {
  return (
    <div className={styles.applyContainer}>
      {/* Left branding panel — hidden on mobile by the layout's own CSS */}
      <aside className={styles.leftPanel}>
        <div className={styles.leftContent}>
          <div className="skeleton" style={{ width: '158px', height: '33px', marginBottom: '40px' }} />
          <div className="skeleton" style={{ width: '80%', height: '80px', marginBottom: '24px' }} />
          <div className="skeleton" style={{ width: '200px', height: '40px', marginBottom: '32px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton" style={{ width: '60%', height: '20px' }} />
            ))}
          </div>
        </div>
      </aside>

      {/* Phone-frame card, same shell the real steps render inside */}
      <main className={styles.rightPanel}>
        <div className={styles.phoneCard}>
          <div className={styles.cardProgress} aria-hidden="true">
            <div className={styles.cardProgressFill} style={{ width: '20%' }} />
          </div>

          <div className={styles.formArea}>
            <div className="skeleton" style={{ width: '70%', height: '28px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ width: '90%', height: '18px', marginBottom: '32px' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="skeleton" style={{ width: '120px', height: '14px', marginBottom: '8px' }} />
                  <div className="skeleton" style={{ width: '100%', height: '48px', borderRadius: '10px' }} />
                </div>
              ))}
            </div>

            <div className="skeleton" style={{ width: '100%', height: '54px', borderRadius: '10px', marginTop: '28px' }} />
          </div>

          <div className={styles.homeIndicator} aria-hidden="true" />
        </div>
      </main>
    </div>
  );
}

import React from 'react';
import styles from '@/components/layout/ApplyLayout/ApplyLayout.module.css';

export default function ApplyLoading() {
  return (
    <div className={styles.applyContainer}>
      {/* Left Panel - Hidden on Mobile */}
      <aside className={styles.leftPanel}>
        <div className={styles.leftContent}>
          <div className="skeleton" style={{ width: '120px', height: '32px', marginBottom: '40px' }} />
          <div className="skeleton" style={{ width: '80%', height: '80px', marginBottom: '24px' }} />
          <div className="skeleton" style={{ width: '180px', height: '40px', marginBottom: '40px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton" style={{ width: '60%', height: '24px' }} />
            ))}
          </div>
        </div>
      </aside>

      {/* Right Panel - Form Area */}
      <main className={styles.rightPanel}>
        <div className={styles.rightContent}>
          
          {/* Progress Bar Component Skeleton */}
          <div className={styles.progressContainer}>
            <div className="skeleton" style={{ width: '100%', height: '4px', marginBottom: '24px' }} />
            <div className={styles.stepsRow}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div className="skeleton" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                  <div className="skeleton" style={{ width: '60px', height: '12px' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Dynamic Route Content Skeleton */}
          <div className={styles.formArea}>
            <div className="skeleton" style={{ width: '60%', height: '32px', marginBottom: '16px' }} />
            <div className="skeleton" style={{ width: '80%', height: '20px', marginBottom: '40px' }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <div className="skeleton" style={{ width: '120px', height: '16px', marginBottom: '8px' }} />
                <div className="skeleton" style={{ width: '100%', height: '48px', borderRadius: '8px' }} />
              </div>
              <div>
                <div className="skeleton" style={{ width: '140px', height: '16px', marginBottom: '8px' }} />
                <div className="skeleton" style={{ width: '100%', height: '48px', borderRadius: '8px' }} />
              </div>
              <div>
                <div className="skeleton" style={{ width: '100px', height: '16px', marginBottom: '8px' }} />
                <div className="skeleton" style={{ width: '100%', height: '48px', borderRadius: '8px' }} />
              </div>
            </div>
            
            <div className="skeleton" style={{ width: '100%', height: '56px', borderRadius: '12px', marginTop: '32px' }} />
          </div>
        </div>
      </main>
    </div>
  );
}

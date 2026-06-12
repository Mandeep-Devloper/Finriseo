import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <FileQuestion size={64} className={styles.icon} />
        </div>
        <h1 className={styles.errorCode}>404</h1>
        <h2 className={styles.title}>Page not found</h2>
        <p className={styles.description}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className={styles.actions}>
          <Link href="/" className="btn btn--ghost btn--lg">
            Go to Homepage
          </Link>
          <Link href="/apply" className="btn btn--cta btn--lg">
            Apply for a Loan
          </Link>
        </div>
      </div>
    </div>
  );
}

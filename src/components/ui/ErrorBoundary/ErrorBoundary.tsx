'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.iconWrapper}>
              <AlertCircle size={48} className={styles.icon} />
            </div>
            <h1 className={styles.title}>Something went wrong</h1>
            <p className={styles.description}>
              We&apos;re sorry for the inconvenience. Please refresh the page or go back to the homepage.
            </p>
            <div className={styles.actions}>
              <button 
                onClick={() => window.location.reload()} 
                className="btn btn--ghost btn--md"
              >
                Refresh Page
              </button>
              <Link href="/" className="btn btn--cta btn--md">
                Go Home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

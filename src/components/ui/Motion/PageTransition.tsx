'use client';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { usePathname } from 'next/navigation';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    // reducedMotion="user" makes every framer-motion animation beneath this
    // (FadeIn, AnimatedCounter, this transition) honour the OS-level
    // prefers-reduced-motion setting: transforms are dropped, opacity kept.
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}

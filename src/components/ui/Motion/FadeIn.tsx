'use client';
import { motion } from 'framer-motion';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  duration?: number;
  className?: string;
}

const directionMap = {
  up:    { y: 40, x: 0 },
  down:  { y: -40, x: 0 },
  left:  { x: 40, y: 0 },
  right: { x: -40, y: 0 },
  none:  { x: 0, y: 0 },
};

export function FadeIn({ children, delay = 0, direction = 'up', duration = 0.6, className }: FadeInProps) {
  const initial = { opacity: 0, ...directionMap[direction] };
  return (
    <motion.div
      initial={initial}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

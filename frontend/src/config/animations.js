/**
 * UTSAV — Reusable Motion Variants and Animation Tokens
 * Built with official `motion/react`
 * Supports full accessibility and respects `prefers-reduced-motion`
 */

export const fadeInUp = (delay = 0, duration = 0.45) => ({
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration,
      delay,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
});

export const fadeIn = (delay = 0, duration = 0.35) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration,
      delay,
      ease: 'easeOut',
    },
  },
});

export const staggerContainer = (staggerChildren = 0.08, delayChildren = 0.1) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});

export const cardRevealVariant = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export const rotatingPhraseVariant = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.32,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.24,
      ease: 'easeIn',
    },
  },
};

export const panelSlideVariant = {
  initial: (direction) => ({
    opacity: 0,
    x: direction > 0 ? 30 : -30,
  }),
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: (direction) => ({
    opacity: 0,
    x: direction > 0 ? -30 : 30,
    transition: {
      duration: 0.3,
      ease: 'easeIn',
    },
  }),
};

export const buttonHoverTap = {
  hover: { scale: 1.02, transition: { duration: 0.18, ease: 'easeOut' } },
  tap: { scale: 0.98, transition: { duration: 0.1 } },
};

export const chipHoverTap = {
  hover: { y: -2, transition: { duration: 0.15, ease: 'easeOut' } },
  tap: { scale: 0.97 },
};

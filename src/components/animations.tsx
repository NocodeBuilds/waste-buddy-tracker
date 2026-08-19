"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

// ── Easing ───────────────────────────────────────────────────────

export const ease = {
  out: [0.16, 1, 0.3, 1] as const,
  inOut: [0.4, 0, 0.2, 1] as const,
  spring: { type: "spring", stiffness: 400, damping: 30 } as const,
};

// ── Reduced motion guard ─────────────────────────────────────────

export function shouldReduceMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ── Fade + slide up (content sections) ───────────────────────────

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay, ease: ease.out },
  }),
};

export function AnimatedSection({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      custom={delay}
      viewport={{ once: true, margin: "-20px" }}
    >
      {children}
    </motion.div>
  );
}

// ── Stagger children (lists, cards) ──────────────────────────────

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: ease.out } },
};

// ── Scale pop (CTA buttons, interactive elements) ────────────────

export const popScale: Variants = {
  idle: { scale: 1 },
  hover: { scale: 1.02, transition: { duration: 0.2, ease: ease.inOut } },
  tap: { scale: 0.97, transition: { duration: 0.15 } },
};

// ── Shimmer for loading skeletons ────────────────────────────────

export function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-muted/60 ${className}`}
      style={{ backgroundSize: "200% 100%" }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--muted-foreground) / 0.04) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
        }}
        animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

// ── Glow border on hover (cards) ─────────────────────────────────

export function GlowBorder({
  children,
  glowColor = "hsl(var(--accent))",
  className = "",
}: {
  children: React.ReactNode;
  glowColor?: string;
  className?: string;
}) {
  return (
    <motion.div
      className={`relative rounded-xl ${className}`}
      initial={{ boxShadow: `0 0 0 0 ${glowColor}00` }}
      whileHover={{ boxShadow: `0 0 0 2px ${glowColor}40` }}
      transition={{ duration: 0.3, ease: ease.inOut }}
    >
      {children}
    </motion.div>
  );
}

// ── Background spotlight (dashboard hero) ────────────────────────

export function SpotlightBackground({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Soft green radial glow — restrained */}
      <motion.div
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, hsl(142 50% 25% / 0.06) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{
          x: [0, 20, -10, 0],
          y: [0, -15, 10, 0],
          scale: [1, 1.05, 0.97, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
      {/* Secondary subtle accent glow */}
      <motion.div
        className="absolute -bottom-24 -left-24 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, hsl(142 70% 42% / 0.04) 0%, transparent 70%)",
          filter: "blur(30px)",
        }}
        animate={{
          x: [0, -15, 10, 0],
          y: [0, 10, -15, 0],
          scale: [1, 0.95, 1.03, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ── Page transition wrapper ──────────────────────────────────────

export function PageTransition({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: ease.out }}
    >
      {children}
    </motion.div>
  );
}

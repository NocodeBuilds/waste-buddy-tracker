"use client";

// Re-export from framer-motion for components that need it
export { motion, useReducedMotion } from "framer-motion";
export type { Variants } from "framer-motion";

// ── Easing ───────────────────────────────────────────────────────

export const ease = {
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  inOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

// ── Stagger configs ──────────────────────────────────────────────

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: ease.out } },
};

// ── Scale tap (buttons, interactive) ────────────────────────────

export const scaleTap: Variants = {
  idle: { scale: 1 },
  hover: { scale: 1.02, transition: { duration: 0.2, ease: ease.inOut } },
  tap: { scale: 0.97, transition: { duration: 0.12 } },
};

// ── Fade-up entrance ─────────────────────────────────────────────

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: ease.out } },
};

// ── Page transition wrapper ──────────────────────────────────────

export function PageTransition({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

// ── Shimmer skeleton ─────────────────────────────────────────────

export function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-muted/60 ${className}`}>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--muted-foreground)/0.04) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
        }}
      />
    </div>
  );
}

// ── Animated section (fade-up with optional delay) ──────────────

export function AnimatedSection({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

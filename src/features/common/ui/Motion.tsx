import React, { useEffect, useMemo, useState } from "react";

// Lightweight framer-motion shim to reserve animation containers without
// introducing a hard dependency or changing existing JSX.

type MotionModule = {
  motion: any;
  AnimatePresence: React.ComponentType<any>;
};

export type MotionProps = React.HTMLAttributes<HTMLDivElement> & {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
  whileHover?: any;
  whileTap?: any;
  layout?: any;
};

/**
 * MotionContainer tries to render a framer-motion motion.div when available.
 * If framer-motion is not installed, it gracefully falls back to a regular div.
 */
export const MotionContainer: React.FC<MotionProps> = ({ children, ...rest }) => {
  const [mod, setMod] = useState<MotionModule | null>(null);

  useEffect(() => {
    let mounted = true;
    import("framer-motion")
      .then((m: any) => {
        if (mounted) setMod(m as MotionModule);
      })
      .catch(() => {
        // framer-motion not available; keep fallback
      });
    return () => {
      mounted = false;
    };
  }, []);

  const Div = useMemo(() => (mod?.motion?.div ? mod.motion.div : "div"), [mod]);
  return <Div {...rest}>{children}</Div>;
};

/**
 * MotionPresence tries to render AnimatePresence when available, otherwise
 * just renders children.
 */
export const MotionPresence: React.FC<{ exitBeforeEnter?: boolean } & React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  ...rest
}) => {
  const [mod, setMod] = useState<MotionModule | null>(null);
  useEffect(() => {
    let mounted = true;
    import("framer-motion")
      .then((m: any) => {
        if (mounted) setMod(m as MotionModule);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const Presence = mod?.AnimatePresence;
  if (Presence) return <Presence {...rest}>{children}</Presence>;
  return <>{children}</>;
};

export default MotionContainer;


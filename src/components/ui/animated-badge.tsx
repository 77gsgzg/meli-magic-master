import * as React from "react";
import { motion, type Variants, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const pulseVariants: Variants = {
  initial: { scale: 1 },
  pulse: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 1.5,
      ease: "easeInOut",
      repeat: Infinity,
    },
  },
};

const glowVariants: Variants = {
  initial: { boxShadow: "0 0 0 0 currentColor" },
  glow: {
    boxShadow: [
      "0 0 0 0 currentColor",
      "0 0 8px 2px currentColor",
      "0 0 0 0 currentColor",
    ],
    transition: {
      duration: 2,
      ease: "easeInOut",
      repeat: Infinity,
    },
  },
};

const bounceVariants: Variants = {
  initial: { y: 0 },
  bounce: {
    y: [0, -3, 0],
    transition: {
      duration: 0.6,
      ease: "easeInOut",
      repeat: Infinity,
      repeatDelay: 2,
    },
  },
};

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/20 text-primary",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive/20 text-destructive",
        outline: "text-foreground border-border",
        success: "border-transparent bg-success/20 text-success",
        warning: "border-transparent bg-warning/20 text-warning",
        info: "border-transparent bg-info/20 text-info",
        pending: "border-transparent bg-muted text-muted-foreground",
        primary: "border-transparent bg-primary text-primary-foreground",
        "success-solid": "border-transparent bg-success text-success-foreground",
        "warning-solid": "border-transparent bg-warning text-warning-foreground",
        "destructive-solid": "border-transparent bg-destructive text-destructive-foreground",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type AnimationType = "none" | "pulse" | "glow" | "bounce";

interface AnimatedBadgeProps
  extends Omit<HTMLMotionProps<"div">, "ref">,
    VariantProps<typeof badgeVariants> {
  animation?: AnimationType;
  children: React.ReactNode;
}

const AnimatedBadge = React.forwardRef<HTMLDivElement, AnimatedBadgeProps>(
  ({ className, variant, size, animation = "none", children, ...props }, ref) => {
    const getAnimationProps = () => {
      switch (animation) {
        case "pulse":
          return {
            variants: pulseVariants,
            initial: "initial",
            animate: "pulse",
          };
        case "glow":
          return {
            variants: glowVariants,
            initial: "initial",
            animate: "glow",
          };
        case "bounce":
          return {
            variants: bounceVariants,
            initial: "initial",
            animate: "bounce",
          };
        default:
          return {};
      }
    };

    return (
      <motion.div
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        {...getAnimationProps()}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
AnimatedBadge.displayName = "AnimatedBadge";

export { AnimatedBadge, badgeVariants, type AnimationType };

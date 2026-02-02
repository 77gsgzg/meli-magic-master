import * as React from "react";
import { motion, type Variants, type HTMLMotionProps } from "framer-motion";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 touch-manipulation",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-lg shadow-primary/20",
        destructive: "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20",
        outline: "border border-border bg-transparent",
        secondary: "bg-secondary text-secondary-foreground",
        ghost: "",
        link: "text-primary underline-offset-4 hover:underline",
        glass: "bg-card/90 backdrop-blur-xl border border-border/60 text-foreground",
        glow: "bg-primary text-primary-foreground shadow-lg shadow-primary/30",
        success: "bg-success text-success-foreground shadow-lg shadow-success/20",
        warning: "bg-warning text-warning-foreground",
      },
      size: {
        default: "h-10 sm:h-10 px-4 py-2 min-h-touch-sm sm:min-h-0",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-11 sm:h-12 rounded-lg px-6 sm:px-8 text-base",
        xl: "h-12 sm:h-14 rounded-xl px-8 sm:px-10 text-base sm:text-lg font-semibold",
        icon: "h-10 w-10 min-h-touch-sm min-w-touch-sm sm:h-10 sm:w-10 sm:min-h-0 sm:min-w-0",
        "icon-sm": "h-9 w-9",
        "icon-lg": "h-11 w-11 sm:h-12 sm:w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const buttonMotionVariants: Variants = {
  initial: { scale: 1 },
  hover: {
    scale: 1.03,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    },
  },
  tap: {
    scale: 0.97,
    transition: {
      type: "spring" as const,
      stiffness: 600,
      damping: 30,
    },
  },
};

const glowMotionVariants: Variants = {
  initial: { 
    scale: 1,
    boxShadow: "0 10px 30px -10px rgba(var(--primary-rgb), 0.3)",
  },
  hover: {
    scale: 1.03,
    boxShadow: "0 15px 40px -10px rgba(var(--primary-rgb), 0.5)",
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    },
  },
  tap: {
    scale: 0.97,
    boxShadow: "0 5px 20px -5px rgba(var(--primary-rgb), 0.4)",
  },
};

export interface AnimatedButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  enableGlow?: boolean;
}

const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ className, variant, size, asChild = false, enableGlow = false, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref as any}
          {...(props as any)}
        />
      );
    }

    const motionVariants = enableGlow || variant === "glow" 
      ? glowMotionVariants 
      : buttonMotionVariants;

    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        initial="initial"
        whileHover="hover"
        whileTap="tap"
        variants={motionVariants}
        {...props}
      />
    );
  }
);
AnimatedButton.displayName = "AnimatedButton";

export { AnimatedButton, buttonVariants };

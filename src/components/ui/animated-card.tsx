import * as React from "react";
import { motion, type Variants, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-xl border text-card-foreground transition-colors duration-200",
  {
    variants: {
      variant: {
        default: "bg-card border-border/60 shadow-card",
        glass: "bg-card/90 backdrop-blur-xl border-border/60 shadow-card",
        stat: "bg-card/90 backdrop-blur-xl border-border/60 shadow-card border-l-4 border-l-primary",
        elevated: "bg-card border-border/60 shadow-elevated",
        interactive: "bg-card border-border/60 shadow-card cursor-pointer",
        outline: "bg-transparent border-border/60",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const hoverVariants: Variants = {
  default: {
    scale: 1,
    y: 0,
  },
  hover: {
    scale: 1.02,
    y: -4,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    },
  },
  tap: {
    scale: 0.98,
    y: 0,
  },
};

const glowVariants: Variants = {
  default: {
    boxShadow: "0 0 0 0 rgba(var(--primary-rgb), 0)",
  },
  hover: {
    boxShadow: "0 0 30px 0 rgba(var(--primary-rgb), 0.15)",
    transition: {
      duration: 0.3,
    },
  },
};

export interface AnimatedCardProps
  extends Omit<HTMLMotionProps<"div">, "ref">,
    VariantProps<typeof cardVariants> {
  enableHover?: boolean;
  enableGlow?: boolean;
  enableTap?: boolean;
}

const AnimatedCard = React.forwardRef<HTMLDivElement, AnimatedCardProps>(
  (
    {
      className,
      variant,
      enableHover = true,
      enableGlow = false,
      enableTap = true,
      children,
      ...props
    },
    ref
  ) => {
    const motionVariants = enableGlow ? glowVariants : hoverVariants;

    return (
      <motion.div
        ref={ref}
        className={cn(cardVariants({ variant }), className)}
        initial="default"
        whileHover={enableHover ? "hover" : undefined}
        whileTap={enableTap ? "tap" : undefined}
        variants={motionVariants}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
AnimatedCard.displayName = "AnimatedCard";

const AnimatedCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-4 sm:p-5 lg:p-6", className)}
    {...props}
  />
));
AnimatedCardHeader.displayName = "AnimatedCardHeader";

const AnimatedCardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-base sm:text-lg font-semibold leading-tight tracking-tight",
      className
    )}
    {...props}
  />
));
AnimatedCardTitle.displayName = "AnimatedCardTitle";

const AnimatedCardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props}
  />
));
AnimatedCardDescription.displayName = "AnimatedCardDescription";

const AnimatedCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 sm:p-5 lg:p-6 pt-0", className)} {...props} />
));
AnimatedCardContent.displayName = "AnimatedCardContent";

const AnimatedCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-4 sm:p-5 lg:p-6 pt-0 gap-2", className)}
    {...props}
  />
));
AnimatedCardFooter.displayName = "AnimatedCardFooter";

export {
  AnimatedCard,
  AnimatedCardHeader,
  AnimatedCardFooter,
  AnimatedCardTitle,
  AnimatedCardDescription,
  AnimatedCardContent,
};

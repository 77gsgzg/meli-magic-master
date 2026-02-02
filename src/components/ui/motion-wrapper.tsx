import * as React from "react";
import { motion, Variants, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

// Fade In variants
export const fadeInVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
};

// Scale In variants
export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
};

// Slide In variants
export const slideInVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
};

// Stagger children variants
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
};

// Hover lift effect
export const hoverLiftVariants: Variants = {
  rest: { y: 0, scale: 1 },
  hover: { 
    y: -4, 
    scale: 1.02,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
  tap: { y: 0, scale: 0.98 },
};

// Pulse animation
export const pulseVariants: Variants = {
  initial: { scale: 1 },
  pulse: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 0.5,
      ease: "easeInOut",
    },
  },
};

// Shake animation for errors
export const shakeVariants: Variants = {
  initial: { x: 0 },
  shake: {
    x: [-10, 10, -10, 10, 0],
    transition: {
      duration: 0.5,
      ease: "easeInOut",
    },
  },
};

// Bounce animation
export const bounceVariants: Variants = {
  initial: { y: 0 },
  bounce: {
    y: [0, -10, 0],
    transition: {
      duration: 0.5,
      ease: "easeInOut",
    },
  },
};

interface MotionWrapperProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  animation?: "fadeIn" | "scaleIn" | "slideIn" | "hoverLift" | "stagger";
  children: React.ReactNode;
}

export const MotionWrapper = React.forwardRef<HTMLDivElement, MotionWrapperProps>(
  ({ animation = "fadeIn", className, children, ...props }, ref) => {
    const variants = {
      fadeIn: fadeInVariants,
      scaleIn: scaleInVariants,
      slideIn: slideInVariants,
      hoverLift: hoverLiftVariants,
      stagger: staggerContainerVariants,
    }[animation];

    return (
      <motion.div
        ref={ref}
        className={cn(className)}
        initial="hidden"
        animate="visible"
        variants={variants}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
MotionWrapper.displayName = "MotionWrapper";

interface StaggerContainerProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  children: React.ReactNode;
}

export const StaggerContainer = React.forwardRef<HTMLDivElement, StaggerContainerProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(className)}
        initial="hidden"
        animate="visible"
        variants={staggerContainerVariants}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
StaggerContainer.displayName = "StaggerContainer";

interface StaggerItemProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  children: React.ReactNode;
}

export const StaggerItem = React.forwardRef<HTMLDivElement, StaggerItemProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(className)}
        variants={staggerItemVariants}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
StaggerItem.displayName = "StaggerItem";

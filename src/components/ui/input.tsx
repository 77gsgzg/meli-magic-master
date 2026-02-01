import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full rounded-lg border px-4 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 touch-manipulation",
  {
    variants: {
      variant: {
        default: "border-input bg-background focus:border-primary/50",
        glass: "bg-card/90 backdrop-blur-xl border-border/60 focus:border-primary/50 focus:bg-card",
        filled: "bg-secondary border-transparent focus:border-primary/50 focus:bg-card",
      },
      inputSize: {
        default: "h-11 sm:h-10 text-base sm:text-sm",
        sm: "h-9 text-sm px-3",
        lg: "h-12 sm:h-11 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {
  size?: React.ComponentProps<"input">["size"];
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
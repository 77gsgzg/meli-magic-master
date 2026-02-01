import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const textareaVariants = cva(
  "flex w-full rounded-lg border px-4 py-3 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors touch-manipulation resize-none",
  {
    variants: {
      variant: {
        default: "border-input bg-background focus:border-primary/50",
        glass: "bg-card/90 backdrop-blur-xl border-border/60 focus:border-primary/50 focus:bg-card",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface TextareaProps 
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({ variant }), "min-h-[100px]", className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
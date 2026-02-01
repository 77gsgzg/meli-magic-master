import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-11 sm:h-10 items-center justify-center rounded-lg bg-muted/60 p-1 text-muted-foreground w-full sm:w-auto overflow-x-auto scrollbar-none",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 sm:px-4 py-2 text-sm font-medium ring-offset-background transition-all touch-manipulation min-h-[36px]",
      "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/60",
      "hover:text-foreground/80",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      // Flex grow on mobile for equal distribution
      "flex-1 sm:flex-none",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

type SwipeDirection = "left" | "right" | null;

interface TabsContentProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> {
  /** Enable slide animation for swipe navigation */
  animated?: boolean;
  /** Direction of swipe for directional animations */
  swipeDirection?: SwipeDirection;
}

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  TabsContentProps
>(({ className, animated = false, swipeDirection, ...props }, ref) => {
  // Determine animation class based on swipe direction
  const getAnimationClass = () => {
    if (!animated) return "";
    if (swipeDirection === "left") return "data-[state=active]:animate-slide-in-right";
    if (swipeDirection === "right") return "data-[state=active]:animate-slide-in-left";
    return "data-[state=active]:animate-fade-in";
  };

  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-3 sm:mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        getAnimationClass(),
        className,
      )}
      {...props}
    />
  );
});
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
export type { SwipeDirection };
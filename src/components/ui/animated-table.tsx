import * as React from "react";
import { motion, type Variants, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

const tableRowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
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

const staggerContainerVariants: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

interface AnimatedTableProps extends React.HTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
}

const AnimatedTable = React.forwardRef<HTMLTableElement, AnimatedTableProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  )
);
AnimatedTable.displayName = "AnimatedTable";

const AnimatedTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
AnimatedTableHeader.displayName = "AnimatedTableHeader";

interface AnimatedTableBodyProps extends Omit<HTMLMotionProps<"tbody">, "ref"> {
  children: React.ReactNode;
}

const AnimatedTableBody = React.forwardRef<HTMLTableSectionElement, AnimatedTableBodyProps>(
  ({ className, children, ...props }, ref) => (
    <motion.tbody
      ref={ref}
      className={cn("[&_tr:last-child]:border-0", className)}
      initial="hidden"
      animate="visible"
      variants={staggerContainerVariants}
      {...props}
    >
      {children}
    </motion.tbody>
  )
);
AnimatedTableBody.displayName = "AnimatedTableBody";

interface AnimatedTableRowProps extends Omit<HTMLMotionProps<"tr">, "ref"> {
  children: React.ReactNode;
  enableHover?: boolean;
  enableTap?: boolean;
}

const AnimatedTableRow = React.forwardRef<HTMLTableRowElement, AnimatedTableRowProps>(
  ({ className, children, enableHover = true, enableTap = true, ...props }, ref) => (
    <motion.tr
      ref={ref}
      className={cn(
        "border-b transition-colors data-[state=selected]:bg-muted",
        enableHover && "hover:bg-secondary/50 cursor-pointer",
        className
      )}
      variants={tableRowVariants}
      whileHover={enableHover ? { scale: 1.005 } : undefined}
      whileTap={enableTap ? { scale: 0.995 } : undefined}
      {...props}
    >
      {children}
    </motion.tr>
  )
);
AnimatedTableRow.displayName = "AnimatedTableRow";

const AnimatedTableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
));
AnimatedTableHead.displayName = "AnimatedTableHead";

const AnimatedTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
));
AnimatedTableCell.displayName = "AnimatedTableCell";

const AnimatedTableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
AnimatedTableCaption.displayName = "AnimatedTableCaption";

const AnimatedTableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
));
AnimatedTableFooter.displayName = "AnimatedTableFooter";

export {
  AnimatedTable,
  AnimatedTableHeader,
  AnimatedTableBody,
  AnimatedTableRow,
  AnimatedTableHead,
  AnimatedTableCell,
  AnimatedTableCaption,
  AnimatedTableFooter,
};

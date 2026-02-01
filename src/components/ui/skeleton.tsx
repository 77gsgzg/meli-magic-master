import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        "animate-pulse rounded-lg bg-muted/60", 
        className
      )} 
      {...props} 
    />
  );
}

function SkeletonText({ className, lines = 1, ...props }: React.HTMLAttributes<HTMLDivElement> & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={cn(
            "h-4",
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
          )} 
        />
      ))}
    </div>
  );
}

function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border border-border/60 p-4 sm:p-5 space-y-4", className)} {...props}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-1/2" />
        </div>
        <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl" />
      </div>
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

function SkeletonTable({ rows = 5, columns = 4, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { rows?: number; columns?: number }) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {/* Header */}
      <div className="flex gap-4 py-3 border-b border-border/60">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 py-3">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonTable };
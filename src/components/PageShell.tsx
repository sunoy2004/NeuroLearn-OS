import { cn } from "@/lib/utils";

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  /** Narrower max width for settings-style pages */
  narrow?: boolean;
}

/** Responsive page wrapper — mobile padding, desktop spacing */
export function PageShell({ children, className, narrow }: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 space-y-4 sm:space-y-6",
        "px-4 py-4 sm:px-6 sm:py-6",
        narrow ? "max-w-[900px]" : "max-w-[1400px]",
        className
      )}
    >
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

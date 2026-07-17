import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Reusable liquid-glass page header.
 * Wraps the title section in a glass-hero panel.
 */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div
    >
      <div className={cn("glass-hero rounded-2xl px-5 py-3 mb-2 overflow-hidden", className)}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            {eyebrow && (
              <div className="text-[10px] font-semibold uppercase tracking-widest text-primary/70 mb-0.5">
                {eyebrow}
              </div>
            )}
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-gradient">
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground text-xs mt-0.5">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex gap-2 flex-wrap items-center">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

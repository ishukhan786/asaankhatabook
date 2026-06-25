import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ReactNode } from "react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="glass-card flex flex-col items-center justify-center p-12 text-center rounded-3xl min-h-[300px] border-dashed border-2">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 shadow-inner">
        <Icon className="w-10 h-10 text-primary" />
      </div>
      <h3 className="text-xl font-display font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {action && <div>{action}</div>}
    </Card>
  );
}

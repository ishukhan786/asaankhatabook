import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type TableSkeletonProps = {
  columns?: number;
  rows?: number;
};

export function TableSkeleton({ columns = 5, rows = 5 }: TableSkeletonProps) {
  return (
    <Card className="glass overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border/50">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={`th-${i}`} className="px-4 py-3 text-left">
                  <Skeleton className="h-4 w-24" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={`tr-${r}`} className="border-b border-border/50 last:border-0">
                {Array.from({ length: columns }).map((_, c) => (
                  <td key={`td-${r}-${c}`} className="px-4 py-4">
                    <Skeleton className={`h-4 ${c === columns - 1 ? 'w-12 ml-auto' : 'w-full max-w-[150px]'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

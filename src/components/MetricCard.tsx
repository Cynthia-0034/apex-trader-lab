import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  variant?: 'default' | 'profit' | 'loss' | 'warning';
  icon?: React.ReactNode;
}

export function MetricCard({ label, value, subValue, variant = 'default', icon }: MetricCardProps) {
  const valueColor = {
    default: 'text-foreground',
    profit: 'text-profit',
    loss: 'text-loss',
    warning: 'text-warning',
  }[variant];

  return (
    <div className="trading-card flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="metric-label">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <span className={cn("metric-value", valueColor)}>{value}</span>
      {subValue && (
        <span className="text-xs text-muted-foreground font-mono">{subValue}</span>
      )}
    </div>
  );
}

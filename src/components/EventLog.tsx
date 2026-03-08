import { cn } from "@/lib/utils";
import { SystemEvent } from "@/lib/mockData";
import { AlertCircle, Info, AlertTriangle, ArrowLeftRight, Zap } from "lucide-react";

const iconMap = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  trade: ArrowLeftRight,
  signal: Zap,
};

const colorMap = {
  info: 'text-primary',
  warning: 'text-warning',
  error: 'text-loss',
  trade: 'text-profit',
  signal: 'text-primary',
};

interface EventLogProps {
  events: SystemEvent[];
  maxItems?: number;
}

export function EventLog({ events, maxItems = 10 }: EventLogProps) {
  const items = events.slice(0, maxItems);

  return (
    <div className="space-y-1">
      {items.map((event) => {
        const Icon = iconMap[event.type];
        return (
          <div
            key={event.id}
            className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-accent/30 transition-colors"
          >
            <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", colorMap[event.type])} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-snug">{event.message}</p>
              <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                {new Date(event.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

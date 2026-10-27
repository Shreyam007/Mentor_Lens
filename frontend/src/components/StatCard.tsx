import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  isGoodTrend?: boolean; // if true, trend direction is displayed in green mint
  subtext?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  isGoodTrend = true,
  subtext,
  className = '',
}: StatCardProps) {
  return (
    <div
      className={`bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal flex flex-col justify-between ${className}`}
    >
      <div>
        <p className="text-sm font-semibold text-muted uppercase tracking-wider">{label}</p>
        <p className="font-display text-3xl font-extrabold tracking-tight mt-1 text-ink">{value}</p>
      </div>

      {(delta || subtext) && (
        <div className="mt-4 flex items-center justify-between text-xs font-medium">
          {delta && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border-2 border-ink shadow-brutal-sm font-bold ${
                isGoodTrend ? 'bg-mint text-ink' : 'bg-tomato text-white'
              }`}
            >
              {isGoodTrend ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{delta}</span>
            </span>
          )}
          {subtext && <span className="text-muted">{subtext}</span>}
        </div>
      )}
    </div>
  );
}

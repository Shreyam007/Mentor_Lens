import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { RateLimitDetail } from '../lib/api';

export default function RateLimitBanner() {
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitDetail | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  useEffect(() => {
    const handleRateLimit = (e: CustomEvent<RateLimitDetail>) => {
      const detail = e.detail;
      setRateLimitInfo(detail);
      setSecondsRemaining(Math.max(1, detail.retryAfter || 60));
    };

    window.addEventListener('mentorlens:ratelimit' as any, handleRateLimit as any);
    return () => {
      window.removeEventListener('mentorlens:ratelimit' as any, handleRateLimit as any);
    };
  }, []);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      if (rateLimitInfo) {
        setRateLimitInfo(null);
      }
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining, rateLimitInfo]);

  if (!rateLimitInfo || secondsRemaining <= 0) {
    return null;
  }

  return (
    <aside
      aria-label="Rate Limit Warning"
      className="w-full max-w-7xl mx-auto mb-4 px-4 sm:px-6 lg:px-8 animate-fadeIn"
    >
      <div className="bg-amber-100 dark:bg-amber-950/40 border-2 border-ink rounded-xl p-4 shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-ink">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-400 border-2 border-ink shadow-brutal-sm flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-ink stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold font-display text-sm uppercase tracking-wide">
                Rate Limit Exceeded ({rateLimitInfo.tier?.toUpperCase() || 'API'})
              </h2>
              <span className="inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 bg-ink text-white rounded font-semibold">
                <Clock className="w-3 h-3" />
                {secondsRemaining}s
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              {rateLimitInfo.message} Requests will automatically resume once cooldown completes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            onClick={() => setRateLimitInfo(null)}
            className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4 text-ink" />
          </button>
        </div>
      </div>
    </aside>
  );
}

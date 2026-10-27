import { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, ShieldCheck, Copy, Check } from 'lucide-react';

interface SeverityBadgeProps {
  severity: 'critical' | 'warning' | 'suggestion' | 'info';
  className?: string;
}

export function SeverityBadge({ severity, className = '' }: SeverityBadgeProps) {
  const configs = {
    critical: {
      label: 'Critical',
      icon: AlertTriangle,
      bg: 'bg-tomato text-white border-ink',
    },
    warning: {
      label: 'Warning',
      icon: AlertCircle,
      bg: 'bg-sun text-ink border-ink',
    },
    suggestion: {
      label: 'Suggestion',
      icon: Info,
      bg: 'bg-sky text-ink border-ink',
    },
    info: {
      label: 'Info',
      icon: Info,
      bg: 'bg-surface-2 text-ink border-ink',
    },
  };

  const config = configs[severity] || configs.info;
  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border-2 text-xs font-bold shadow-brutal-sm ${config.bg} ${className}`}
    >
      <IconComponent className="w-3.5 h-3.5 stroke-[2.5]" />
      <span>{config.label}</span>
    </span>
  );
}

export function VerifiedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-mint text-ink border-2 border-ink text-xs font-bold shadow-brutal-sm ${className}`}
      title="Verified by MentorLens Verifier Agent: Commit exists and diff matches claim."
    >
      <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
      <span>Verified History</span>
    </span>
  );
}

export function ShaChip({ sha, className = '' }: { sha: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sha);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 bg-surface border-2 border-ink rounded-md font-mono text-xs shadow-brutal-sm ${className}`}
    >
      <span className="font-semibold">{sha.slice(0, 7)}</span>
      <button
        onClick={handleCopy}
        aria-label="Copy Commit SHA"
        className="text-muted hover:text-ink transition-colors"
      >
        {copied ? <Check className="w-3 h-3 text-mint" /> : <Copy className="w-3 h-3" />}
      </button>
    </span>
  );
}

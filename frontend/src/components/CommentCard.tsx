import { useState } from 'react';
import { SeverityBadge, VerifiedBadge, ShaChip } from './Badges';
import { Finding } from '../lib/api';
import { Check, Copy, ThumbsUp, ThumbsDown, CheckCircle2, XCircle } from 'lucide-react';

interface CommentCardProps {
  finding: Finding;
  onFeedback?: (val: 'helpful' | 'not_helpful') => void;
  onMarkFixed?: () => void;
  onDismiss?: (reason: string) => void;
  className?: string;
}

export function CommentCard({
  finding,
  onFeedback,
  onMarkFixed,
  onDismiss,
  className = '',
}: CommentCardProps) {
  const [copied, setCopied] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [dismissReason, setDismissReason] = useState('');

  const copySuggestion = () => {
    if (finding.suggested_code) {
      navigator.clipboard.writeText(finding.suggested_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasVerifiedCitation = finding.citations && finding.citations.some(c => c.verdict === 'approved');
  const citation = finding.citations && finding.citations[0];

  return (
    <article
      className={`bg-surface rounded-xl border-3 border-ink shadow-brutal p-5 my-4 space-y-4 ${
        finding.status === 'outdated' ? 'opacity-70 border-dashed' : ''
      } ${className}`}
    >
      {/* Header: Severity + Title + Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink pb-3">
        <div className="flex items-center gap-2.5">
          <SeverityBadge severity={finding.severity} />
          <h3 className="font-display text-lg font-bold tracking-tight text-ink">
            {finding.title}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2 py-0.5 bg-surface-2 border border-ink rounded">
            Line {finding.line_start}
          </span>
          {finding.status === 'outdated' && (
            <span className="px-2 py-0.5 bg-sun text-ink border border-ink rounded font-bold">
              Resolved in newer commit
            </span>
          )}
        </div>
      </div>

      {/* Section 1: Why this is risky */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
          Why this is risky
        </h4>
        <p className="text-sm leading-relaxed text-ink">{finding.why_risky}</p>
      </div>

      {/* Section 2: How to fix */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
          How to fix
        </h4>
        <p className="text-sm leading-relaxed text-ink">{finding.fix}</p>

        {finding.suggested_code && (
          <div className="relative mt-2 rounded-lg border-2 border-ink bg-paper p-3 font-mono text-xs shadow-brutal-sm">
            <button
              onClick={copySuggestion}
              aria-label="Copy Suggested Code"
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-surface border-2 border-ink rounded text-xs font-bold shadow-brutal-sm hover:translate-y-[-1px] transition-transform"
            >
              {copied ? <Check className="w-3 h-3 text-mint" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <pre className="overflow-x-auto pt-2">{finding.suggested_code}</pre>
          </div>
        )}
      </div>

      {/* Section 3: From your team's history */}
      <div className="space-y-2 pt-2 border-t-2 border-surface-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            From your team's history
          </h4>
          {hasVerifiedCitation && <VerifiedBadge />}
        </div>

        {hasVerifiedCitation && citation ? (
          <div className="bg-surface-2 p-3.5 rounded-lg border-2 border-ink shadow-brutal-sm space-y-2 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShaChip sha={citation.sha} />
                <span className="font-semibold text-ink">Past bug-fix resolution</span>
              </div>
              <span className="text-muted font-mono">{Math.round(citation.similarity * 100)}% match</span>
            </div>
            <p className="text-muted italic">"{citation.reason}"</p>
          </div>
        ) : (
          <div className="bg-surface-2/60 p-3 rounded-lg border border-ink text-xs text-muted italic">
            No similar past mistake found — general guidance provided.
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t-2 border-ink text-xs font-semibold">
        <div className="flex items-center gap-2">
          <span>Was this helpful?</span>
          <button
            onClick={() => {
              setFeedbackSent('helpful');
              onFeedback?.('helpful');
            }}
            disabled={feedbackSent !== null}
            className={`btn-brutal inline-flex items-center gap-1 px-2.5 py-1 rounded border-2 border-ink shadow-brutal-sm ${
              feedbackSent === 'helpful' ? 'bg-mint text-ink font-bold' : 'bg-surface hover:bg-surface-2'
            }`}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>Helpful</span>
          </button>
          <button
            onClick={() => {
              setFeedbackSent('not_helpful');
              onFeedback?.('not_helpful');
            }}
            disabled={feedbackSent !== null}
            className={`btn-brutal inline-flex items-center gap-1 px-2.5 py-1 rounded border-2 border-ink shadow-brutal-sm ${
              feedbackSent === 'not_helpful' ? 'bg-tomato text-white font-bold' : 'bg-surface hover:bg-surface-2'
            }`}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            <span>Not helpful</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onMarkFixed}
            className="btn-brutal inline-flex items-center gap-1 px-2.5 py-1 bg-surface border-2 border-ink rounded shadow-brutal-sm hover:bg-mint/30"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-mint" />
            <span>Mark fixed</span>
          </button>

          {!dismissing ? (
            <button
              onClick={() => setDismissing(true)}
              className="btn-brutal inline-flex items-center gap-1 px-2.5 py-1 bg-surface border-2 border-ink rounded shadow-brutal-sm hover:bg-tomato/20"
            >
              <XCircle className="w-3.5 h-3.5 text-tomato" />
              <span>Dismiss</span>
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Reason (e.g. false positive)"
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                className="px-2 py-0.5 border-2 border-ink rounded text-xs bg-surface"
              />
              <button
                onClick={() => {
                  onDismiss?.(dismissReason || 'Dismissed by developer');
                  setDismissing(false);
                }}
                className="px-2 py-0.5 bg-tomato text-white border-2 border-ink rounded font-bold"
              >
                Confirm
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

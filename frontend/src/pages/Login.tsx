import { useState } from 'react';
import { Eye, Github, Loader2, AlertCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const errorParam = searchParams.get('error');

  const [activeError, setActiveError] = useState<string | null>(
    errorParam === 'cancelled'
      ? 'GitHub authorization was cancelled. Try again.'
      : errorParam === 'expired'
      ? 'Your session expired. Sign in again.'
      : null
  );

  const handleGitHubLogin = () => {
    setIsLoading(true);
    // In production, redirects to /api/auth/github/login
    setTimeout(() => {
      window.location.href = '/onboarding/repos';
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#111111] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#F4EFE6 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Main 400px Card */}
      <div className="w-full max-w-[400px] bg-paper text-ink p-8 rounded-xl border-3 border-ink shadow-[6px_6px_0px_0px_#FFFFFF] z-10 relative">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-6">
          <span className="w-9 h-9 rounded-md bg-cobalt text-white flex items-center justify-center border-2 border-ink shadow-brutal-sm">
            <Eye className="w-5 h-5 stroke-[2.5]" />
          </span>
          <span className="font-display text-2xl font-extrabold tracking-tight">MentorLens</span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-2xl font-extrabold text-ink leading-tight mb-2">
          Code review that teaches.
        </h1>
        <p className="text-muted text-sm leading-relaxed mb-6">
          Context-aware AI mentor citing your team's real bug fixes to accelerate developer growth.
        </p>

        {/* Error Alert States */}
        {activeError && (
          <div
            role="alert"
            className="mb-5 p-3 bg-coral/15 border-2 border-coral rounded-lg flex items-start gap-2 text-xs font-semibold text-coral animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{activeError}</span>
            </div>
            <button
              onClick={() => setActiveError(null)}
              className="text-muted hover:text-ink text-xs underline font-normal"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* GitHub Button */}
        <button
          onClick={handleGitHubLogin}
          disabled={isLoading}
          className="btn-brutal w-full py-3 px-4 bg-ink text-white font-bold text-sm rounded-lg border-2 border-ink shadow-brutal flex items-center justify-center gap-3 transition-transform disabled:opacity-75 disabled:cursor-wait"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-paper" />
              <span>Connecting to GitHub...</span>
            </>
          ) : (
            <>
              <Github className="w-5 h-5" />
              <span>Continue with GitHub</span>
            </>
          )}
        </button>

        {/* Permissions Subtext */}
        <p className="text-[11px] text-muted text-center mt-4 leading-normal">
          We request read access to pull requests and commit history. We never push code.
        </p>

        {/* State Simulator Controls (for review/demo) */}
        <div className="mt-6 pt-4 border-t-2 border-dashed border-ink/20 flex flex-wrap gap-2 text-[10px] font-mono text-muted">
          <span>Test states:</span>
          <button
            onClick={() => setActiveError('GitHub authorization was cancelled. Try again.')}
            className="hover:underline text-cobalt"
          >
            Auth Cancelled
          </button>
          <span>•</span>
          <button
            onClick={() => setActiveError('Your session expired. Sign in again.')}
            className="hover:underline text-cobalt"
          >
            Expired
          </button>
          <span>•</span>
          <button
            onClick={() => setIsLoading(!isLoading)}
            className="hover:underline text-cobalt"
          >
            Toggle Spin
          </button>
        </div>

        {/* Footer links */}
        <div className="mt-5 pt-3 border-t border-ink/10 flex items-center justify-between text-xs text-muted">
          <div className="flex items-center gap-3">
            <a href="#privacy" className="hover:text-ink hover:underline">Privacy</a>
            <span>•</span>
            <a href="#terms" className="hover:text-ink hover:underline">Terms</a>
          </div>
          <a href="/" className="text-cobalt font-bold hover:underline">
            Dashboard →
          </a>
        </div>
      </div>

      {/* Operational Status Chip */}
      <div className="mt-6 z-10 flex items-center gap-2 px-3 py-1 bg-surface/90 text-paper border border-paper/30 rounded-full font-mono text-xs shadow-brutal-sm">
        <span className="w-2 h-2 rounded-full bg-mint animate-pulse" />
        <span>All systems operational</span>
      </div>
    </div>
  );
}

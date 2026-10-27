import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  WifiOff, 
  ShieldAlert, 
  Copy, 
  Check, 
  RotateCw, 
  Clock, 
  ArrowLeft,
  XCircle,
  FileQuestion,
  Lock,
  Wrench,
  CheckCircle2,
  Info
} from 'lucide-react';
import { Skeleton, EmptyState } from '../components/UIStates';

export default function SystemStatesPage() {
  const [activeTab, setActiveTab] = useState<'404' | '403' | '500' | 'offline' | 'rate_limit' | 'llm_down' | 'app_revoked' | 'session_expired' | 'skeletons' | 'empty' | 'maintenance' | 'destructive' | 'toasts'>('404');
  const [copiedId, setCopiedId] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [offlineSeconds, setOfflineSeconds] = useState(15);

  useEffect(() => {
    if (activeTab === 'offline') {
      const interval = setInterval(() => {
        setOfflineSeconds((s) => (s > 1 ? s - 1 : 15));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const copyRequestId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const tabs = [
    { key: '404', label: '1. 404 Not Found' },
    { key: '403', label: '2. 403 Forbidden' },
    { key: '500', label: '3. 500 Server Error' },
    { key: 'offline', label: '4. Offline Banner' },
    { key: 'rate_limit', label: '5. Rate Limit' },
    { key: 'llm_down', label: '6. LLM Down' },
    { key: 'app_revoked', label: '7. App Revoked' },
    { key: 'session_expired', label: '8. Session Expired' },
    { key: 'skeletons', label: '9. Skeletons' },
    { key: 'empty', label: '10. Empty State' },
    { key: 'maintenance', label: '11. Maintenance' },
    { key: 'destructive', label: '12. Typed Confirmation' },
    { key: 'toasts', label: '13. Live Toasts' },
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-surface p-5 sm:p-6 rounded-xl border-3 border-ink shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-ink">System States Kit (S14)</h1>
          <p className="text-xs text-muted font-mono">
            Full-page and inline error, network, boundary, and accessibility states.
          </p>
        </div>

        <Link
          to="/"
          className="btn-brutal inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface text-ink border-2 border-ink rounded-lg font-mono text-xs font-bold shadow-brutal-sm hover:bg-sand"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* State Switcher Tab Pills */}
      <div className="flex flex-wrap gap-1.5 border-b-2 border-ink pb-3 font-mono text-xs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-3 py-1.5 rounded-lg border-2 font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-cobalt text-white border-ink shadow-brutal-sm'
                : 'bg-surface text-ink border-transparent hover:border-ink/40 hover:bg-surface-2'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Frame Rendering Container */}
      <div className="bg-surface p-8 sm:p-12 rounded-xl border-3 border-ink shadow-brutal min-h-[420px] flex items-center justify-center">
        {/* 1. 404 Not Found */}
        {activeTab === '404' && (
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 rounded-xl bg-sun/20 border-3 border-ink shadow-brutal-sm mx-auto flex items-center justify-center font-display font-extrabold text-2xl text-ink">
              404
            </div>
            <h2 className="font-display font-extrabold text-2xl text-ink">Page Not Found</h2>
            <p className="text-sm text-muted leading-relaxed">
              The pull request, run trace, or repository you are looking for does not exist or has been moved.
            </p>
            <div className="pt-2">
              <Link
                to="/"
                className="btn-brutal inline-flex items-center gap-2 px-5 py-2.5 bg-cobalt text-white border-2 border-ink rounded-lg font-bold text-xs shadow-brutal"
              >
                Return to Team Dashboard →
              </Link>
            </div>
          </div>
        )}

        {/* 2. 403 Forbidden */}
        {activeTab === '403' && (
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 rounded-xl bg-coral/20 border-3 border-ink shadow-brutal-sm mx-auto flex items-center justify-center text-coral">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="font-display font-extrabold text-2xl text-ink">Access Restricted (403)</h2>
            <p className="text-sm text-muted leading-relaxed">
              You do not have permission to view institutional code memory for <strong className="text-ink">private-core-service</strong>.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => alert('Access request submitted to org owners.')}
                className="btn-brutal px-4 py-2 bg-cobalt text-white border-2 border-ink rounded-lg font-bold text-xs shadow-brutal"
              >
                Request Access from Org Admins
              </button>
              <Link
                to="/login"
                className="btn-brutal px-4 py-2 bg-surface text-ink border-2 border-ink rounded-lg font-bold text-xs shadow-brutal-sm"
              >
                Switch Account
              </Link>
            </div>
          </div>
        )}

        {/* 3. 500 Something Went Wrong */}
        {activeTab === '500' && (
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 rounded-xl bg-coral text-white border-3 border-ink shadow-brutal-sm mx-auto flex items-center justify-center font-display font-extrabold text-2xl">
              !
            </div>
            <h2 className="font-display font-extrabold text-2xl text-ink">Something went wrong (500)</h2>
            <p className="text-sm text-muted leading-relaxed">
              An unexpected internal server error occurred while processing this pipeline operation.
            </p>
            <div className="p-2.5 bg-surface-2 border-2 border-ink rounded-lg font-mono text-xs flex items-center justify-between">
              <span className="text-muted">req-9842a-c108-4bf2</span>
              <button
                onClick={() => copyRequestId('req-9842a-c108-4bf2')}
                className="text-cobalt font-bold hover:underline flex items-center gap-1"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-mint" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
              </button>
            </div>
            <div className="pt-2">
              <button
                onClick={() => window.location.reload()}
                className="btn-brutal px-5 py-2.5 bg-surface text-ink border-2 border-ink rounded-lg font-bold text-xs shadow-brutal hover:bg-sand"
              >
                Reload Page
              </button>
            </div>
          </div>
        )}

        {/* 4. Offline Banner */}
        {activeTab === 'offline' && (
          <div className="w-full max-w-lg space-y-4">
            <div className="p-4 bg-sun/20 border-3 border-sun rounded-xl shadow-brutal flex items-start gap-3">
              <WifiOff className="w-6 h-6 text-ink shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <h3 className="font-bold text-ink text-sm">Internet Connection Lost</h3>
                <p className="text-xs text-muted">
                  You are offline. MentorLens will automatically reconnect when your network returns.
                </p>
                <div className="flex items-center gap-2 pt-1 font-mono text-xs text-ink font-bold">
                  <RotateCw className="w-3 h-3 animate-spin" />
                  <span>Auto-retrying in {offlineSeconds}s...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. GitHub API Rate Limit Reached */}
        {activeTab === 'rate_limit' && (
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 rounded-xl bg-sun/30 border-3 border-ink shadow-brutal-sm mx-auto flex items-center justify-center">
              <Clock className="w-8 h-8 text-ink" />
            </div>
            <h2 className="font-display font-extrabold text-2xl text-ink">GitHub API Rate Limit Reached</h2>
            <p className="text-sm text-muted leading-relaxed">
              GitHub primary API quota reached. Reviews are queued safely and will resume automatically when quota resets.
            </p>
            <div className="inline-block px-3 py-1 bg-surface-2 border-2 border-ink rounded-lg font-mono text-xs font-bold text-ink">
              Quota resets in: 12 minutes
            </div>
          </div>
        )}

        {/* 6. LLM Unavailable Banner */}
        {activeTab === 'llm_down' && (
          <div className="w-full max-w-lg space-y-4">
            <div className="p-4 bg-cobalt/10 border-3 border-cobalt rounded-xl shadow-brutal flex items-start gap-3">
              <Info className="w-6 h-6 text-cobalt shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-bold text-cobalt text-sm">LLM Provider Temporarily Unavailable</h3>
                <p className="text-xs text-ink leading-relaxed">
                  Showing static-analysis feedback only. History retrieval citations are paused until LLM connection restores.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 7. GitHub App Uninstalled / Access Revoked */}
        {activeTab === 'app_revoked' && (
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 rounded-xl bg-coral/20 border-3 border-ink shadow-brutal-sm mx-auto flex items-center justify-center text-coral">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="font-display font-extrabold text-2xl text-ink">GitHub App Access Revoked</h2>
            <p className="text-sm text-muted leading-relaxed">
              The MentorLens GitHub App installation was removed or its permissions were revoked in organization settings.
            </p>
            <div className="pt-2">
              <button
                onClick={() => window.open('https://github.com/apps', '_blank')}
                className="btn-brutal px-5 py-2.5 bg-cobalt text-white border-2 border-ink rounded-lg font-bold text-xs shadow-brutal"
              >
                Re-install GitHub App →
              </button>
            </div>
          </div>
        )}

        {/* 8. Session Expired Modal */}
        {activeTab === 'session_expired' && (
          <div className="max-w-md p-6 bg-surface border-3 border-ink rounded-xl shadow-brutal-lg text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-sun/20 border-2 border-ink mx-auto flex items-center justify-center">
              <Clock className="w-6 h-6 text-ink" />
            </div>
            <h3 className="font-display font-extrabold text-xl text-ink">Your Session Expired</h3>
            <p className="text-xs text-muted leading-relaxed">
              For security, active sessions expire after 24 hours of inactivity. Please sign in again with GitHub.
            </p>
            <Link
              to="/login?error=expired"
              className="btn-brutal inline-block w-full py-2.5 bg-cobalt text-white border-2 border-ink rounded-lg font-bold text-xs shadow-brutal"
            >
              Sign In Again →
            </Link>
          </div>
        )}

        {/* 9. Loading Skeletons */}
        {activeTab === 'skeletons' && (
          <div className="w-full max-w-2xl space-y-6">
            <div className="space-y-2">
              <p className="font-mono text-xs font-bold text-ink">Table Skeleton</p>
              <div className="space-y-2 p-4 bg-surface-2 border-2 border-ink rounded-lg">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-mono text-xs font-bold text-ink">Diff Viewer Skeleton</p>
              <div className="space-y-1.5 p-4 bg-surface-2 border-2 border-ink rounded-lg font-mono">
                <Skeleton className="h-5 w-1/4 mb-2" />
                <Skeleton className="h-4 w-full bg-mint/20" />
                <Skeleton className="h-4 w-3/4 bg-coral/20" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
          </div>
        )}

        {/* 10. Generic Empty State */}
        {activeTab === 'empty' && (
          <EmptyState
            icon={FileQuestion}
            title="No Items Found"
            description="There are no items matching this filter or repository context. Open a pull request or try resetting filters."
            actionLabel="Reset Filters"
            onAction={() => alert('Filters reset.')}
          />
        )}

        {/* 11. Maintenance Mode */}
        {activeTab === 'maintenance' && (
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 rounded-xl bg-sand border-3 border-ink shadow-brutal-sm mx-auto flex items-center justify-center">
              <Wrench className="w-8 h-8 text-ink" />
            </div>
            <h2 className="font-display font-extrabold text-2xl text-ink">Scheduled Maintenance</h2>
            <p className="text-sm text-muted leading-relaxed">
              MentorLens is undergoing scheduled vector database optimization. PR reviews will resume in approximately 15 minutes.
            </p>
          </div>
        )}

        {/* 12. Typed Destructive Confirmation */}
        {activeTab === 'destructive' && (
          <div className="max-w-md p-6 bg-surface border-3 border-ink rounded-xl shadow-brutal space-y-4">
            <h3 className="font-display font-extrabold text-lg text-ink">Delete Repository Index</h3>
            <p className="text-xs text-muted leading-relaxed">
              Type <strong className="font-mono text-ink">campus-portal</strong> to confirm permanent deletion of all vector memory.
            </p>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="campus-portal"
              className="w-full px-3 py-2 bg-surface-2 border-2 border-ink rounded-lg font-mono text-xs focus:ring-2 focus:ring-tangerine"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={confirmInput !== 'campus-portal'}
                onClick={() => {
                  alert('Repository index deleted.');
                  setConfirmInput('');
                }}
                className="btn-brutal px-4 py-2 bg-coral text-white border-2 border-ink rounded-lg font-bold text-xs shadow-brutal disabled:opacity-40"
              >
                Permanently Delete Index
              </button>
            </div>
          </div>
        )}

        {/* 13. Toasts */}
        {activeTab === 'toasts' && (
          <div className="w-full max-w-md space-y-3 font-mono text-xs">
            <div
              role="status"
              className="p-3 bg-mint/20 border-2 border-mint rounded-lg flex items-center gap-2.5 shadow-brutal-sm"
            >
              <CheckCircle2 className="w-4 h-4 text-mint stroke-[2.5]" />
              <span className="font-bold text-ink">Review completed: 2 citations verified</span>
            </div>

            <div
              role="alert"
              className="p-3 bg-coral/20 border-2 border-coral rounded-lg flex items-center gap-2.5 shadow-brutal-sm text-coral"
            >
              <XCircle className="w-4 h-4 text-coral stroke-[2.5]" />
              <span className="font-bold">Check run failed: 1 critical security finding</span>
            </div>

            <div
              role="status"
              className="p-3 bg-cobalt/15 border-2 border-cobalt rounded-lg flex items-center gap-2.5 shadow-brutal-sm text-cobalt"
            >
              <Info className="w-4 h-4 stroke-[2.5]" />
              <span className="font-bold">Team memory re-sync scheduled</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

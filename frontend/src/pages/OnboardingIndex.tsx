import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  RotateCw, 
  AlertTriangle, 
  Terminal, 
  Clock, 
  Database,
  ArrowRight
} from 'lucide-react';

type IndexStage = 'fetching_commits' | 'extracting_bugfixes' | 'chunking_functions' | 'embedding' | 'ready' | 'failed';

interface RepoProgress {
  id: string;
  name: string;
  stage: IndexStage;
  progressPercent: number;
  commitsProcessed: number;
  totalCommits: number;
  bugfixCommits: number;
  functionChunks: number;
  eta: string;
  error?: string;
  isColdStart?: boolean;
  logs: string[];
}

export default function OnboardingIndexPage() {
  const navigate = useNavigate();
  const [showLogs, setShowLogs] = useState(false);
  const [stateMode, setStateMode] = useState<'in_progress' | 'completed' | 'partial_failure' | 'cold_start'>('in_progress');

  const [repos, setRepos] = useState<RepoProgress[]>([
    {
      id: 'repo-1',
      name: 'campus-portal',
      stage: 'chunking_functions',
      progressPercent: 68,
      commitsProcessed: 965,
      totalCommits: 1420,
      bugfixCommits: 214,
      functionChunks: 1832,
      eta: '18s remaining',
      logs: [
        '[12:00:01] GET /repos/campus-portal/commits (page 1-10 fetched)',
        '[12:00:04] Rule heuristics applied: 214 bug-fix commits isolated',
        '[12:00:09] AST tree parser parsing python functions in src/auth.py',
        '[12:00:14] Redacting sensitive credentials and API tokens',
        '[12:00:18] Generating embeddings with model text-embedding-3-small...',
      ],
    },
    {
      id: 'repo-6',
      name: 'mentorlens-demo',
      stage: 'ready',
      progressPercent: 100,
      commitsProcessed: 38,
      totalCommits: 38,
      bugfixCommits: 9,
      functionChunks: 42,
      eta: 'Completed',
      logs: [
        '[12:00:01] Seed repo detected: 38 commits parsed',
        '[12:00:03] Isolated 9 ground-truth bugfix patterns',
        '[12:00:05] Stored in Chroma collection "ml_team_memory_repo_6"',
      ],
    },
  ]);

  // Handle switching state simulation modes
  useEffect(() => {
    if (stateMode === 'completed') {
      setRepos([
        {
          id: 'repo-1',
          name: 'campus-portal',
          stage: 'ready',
          progressPercent: 100,
          commitsProcessed: 1420,
          totalCommits: 1420,
          bugfixCommits: 214,
          functionChunks: 1832,
          eta: 'Ready',
          logs: ['[12:00:22] Indexing complete: 214 bug-fix commits indexed, 1,832 function chunks.'],
        },
        {
          id: 'repo-6',
          name: 'mentorlens-demo',
          stage: 'ready',
          progressPercent: 100,
          commitsProcessed: 38,
          totalCommits: 38,
          bugfixCommits: 9,
          functionChunks: 42,
          eta: 'Ready',
          logs: ['[12:00:05] Ready.'],
        },
      ]);
    } else if (stateMode === 'partial_failure') {
      setRepos([
        {
          id: 'repo-1',
          name: 'campus-portal',
          stage: 'failed',
          progressPercent: 42,
          commitsProcessed: 590,
          totalCommits: 1420,
          bugfixCommits: 84,
          functionChunks: 512,
          eta: 'Halted',
          error: 'GitHub API rate limit exceeded during commit fetch. Rate limit resets in 8 minutes.',
          logs: ['[12:00:12] ERROR: HTTP 403 API rate limit exceeded for installation token.'],
        },
        {
          id: 'repo-6',
          name: 'mentorlens-demo',
          stage: 'ready',
          progressPercent: 100,
          commitsProcessed: 38,
          totalCommits: 38,
          bugfixCommits: 9,
          functionChunks: 42,
          eta: 'Ready',
          logs: ['[12:00:05] Ready.'],
        },
      ]);
    } else if (stateMode === 'cold_start') {
      setRepos([
        {
          id: 'repo-1',
          name: 'fresh-project',
          stage: 'ready',
          progressPercent: 100,
          commitsProcessed: 6,
          totalCommits: 6,
          bugfixCommits: 1,
          functionChunks: 4,
          eta: 'Ready',
          isColdStart: true,
          logs: ['[12:00:02] Repository contains only 6 commits.'],
        },
      ]);
    } else {
      // In progress
      setRepos([
        {
          id: 'repo-1',
          name: 'campus-portal',
          stage: 'chunking_functions',
          progressPercent: 68,
          commitsProcessed: 965,
          totalCommits: 1420,
          bugfixCommits: 214,
          functionChunks: 1832,
          eta: '18s remaining',
          logs: [
            '[12:00:01] GET /repos/campus-portal/commits (page 1-10 fetched)',
            '[12:00:04] Rule heuristics applied: 214 bug-fix commits isolated',
            '[12:00:09] AST tree parser parsing python functions in src/auth.py',
            '[12:00:18] Generating embeddings with model text-embedding-3-small...',
          ],
        },
      ]);
    }
  }, [stateMode]);

  const STAGES: { key: IndexStage; label: string }[] = [
    { key: 'fetching_commits', label: 'Fetching commits' },
    { key: 'extracting_bugfixes', label: 'Extracting bug-fix commits' },
    { key: 'chunking_functions', label: 'Chunking functions' },
    { key: 'embedding', label: 'Embedding' },
    { key: 'ready', label: 'Ready' },
  ];

  const handleRetry = (repoId: string) => {
    setRepos((prev) =>
      prev.map((r) =>
        r.id === repoId
          ? { ...r, stage: 'chunking_functions', progressPercent: 50, error: undefined }
          : r
      )
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* 3-Step Stepper Header */}
      <div className="bg-surface p-4 sm:p-6 rounded-xl border-3 border-ink shadow-brutal">
        <div className="flex items-center justify-between max-w-2xl mx-auto relative">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-mint text-ink font-bold flex items-center justify-center border-2 border-ink shadow-brutal-sm text-xs">
              <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <p className="text-[11px] font-mono uppercase text-muted">Step 1</p>
              <p className="text-xs font-bold text-ink">Connect GitHub</p>
            </div>
          </div>

          <div className="flex-1 h-0.5 bg-ink/30 mx-4" />

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-mint text-ink font-bold flex items-center justify-center border-2 border-ink shadow-brutal-sm text-xs">
              <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <p className="text-[11px] font-mono uppercase text-muted">Step 2</p>
              <p className="text-xs font-bold text-ink">Repositories Chosen</p>
            </div>
          </div>

          <div className="flex-1 h-0.5 bg-ink/30 mx-4" />

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-cobalt text-white font-bold flex items-center justify-center border-2 border-ink shadow-brutal-sm text-xs">
              3
            </div>
            <div>
              <p className="text-[11px] font-mono uppercase font-bold text-cobalt">Step 3</p>
              <p className="text-xs font-extrabold text-ink">Learn from History</p>
            </div>
          </div>
        </div>
      </div>

      {/* Simulator Mode Bar */}
      <div className="p-3 bg-surface-2 border-2 border-dashed border-ink/40 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <span className="text-muted">Test S03 UI Frames:</span>
        <div className="flex flex-wrap gap-2">
          {(['in_progress', 'completed', 'partial_failure', 'cold_start'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setStateMode(mode)}
              className={`px-2.5 py-1 rounded border-2 border-ink font-bold ${
                stateMode === mode
                  ? 'bg-cobalt text-white shadow-brutal-sm'
                  : 'bg-surface text-ink hover:bg-sand'
              }`}
            >
              {mode.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Repo Progress Cards */}
      <div className="space-y-6">
        {repos.map((repo) => {
          const currentStageIndex = STAGES.findIndex((s) => s.key === repo.stage);

          return (
            <div
              key={repo.id}
              className="bg-surface p-6 rounded-xl border-3 border-ink shadow-brutal space-y-6"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-2 border-2 border-ink shadow-brutal-sm flex items-center justify-center font-mono font-bold text-ink">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-mono text-lg font-bold text-ink">{repo.name}</h2>
                    <p className="text-xs text-muted font-mono">
                      {repo.commitsProcessed} / {repo.totalCommits} commits analysed
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-2 border-2 border-ink rounded-full text-xs font-mono font-bold">
                    <Clock className="w-3.5 h-3.5 text-muted" />
                    <span>{repo.eta}</span>
                  </span>
                </div>
              </div>

              {/* Cold Start Alert */}
              {repo.isColdStart && (
                <div className="p-4 bg-sun/15 border-2 border-sun rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-ink font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 text-ink" />
                    <span>Cold Start Detected</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Only 6 commits found. Reviews will work, but history citations will be limited until more bug-fixes are merged into the repository.
                  </p>
                  <button
                    onClick={() => navigate('/')}
                    className="btn-brutal px-3.5 py-1.5 bg-surface text-ink border-2 border-ink rounded-lg font-bold text-xs shadow-brutal-sm"
                  >
                    Continue Anyway →
                  </button>
                </div>
              )}

              {/* Error Message */}
              {repo.error && (
                <div className="p-4 bg-coral/15 border-2 border-coral rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-coral font-bold text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Indexing Interrupted</span>
                  </div>
                  <p className="text-xs text-ink">{repo.error}</p>
                  <button
                    onClick={() => handleRetry(repo.id)}
                    className="btn-brutal inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface text-ink border-2 border-ink rounded-lg font-bold text-xs shadow-brutal-sm"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Retry Indexing</span>
                  </button>
                </div>
              )}

              {/* Stage Stepper List */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-[11px]">
                {STAGES.map((s, idx) => {
                  const isDone = repo.stage === 'ready' || currentStageIndex > idx;
                  const isCurrent = repo.stage === s.key;

                  return (
                    <div
                      key={s.key}
                      className={`p-2.5 rounded-lg border-2 text-center transition-all ${
                        isDone
                          ? 'bg-mint/15 border-mint text-ink font-semibold'
                          : isCurrent
                          ? 'bg-cobalt text-white border-ink shadow-brutal-sm font-bold scale-[1.02]'
                          : 'bg-surface-2 border-ink/20 text-muted'
                      }`}
                    >
                      <div className="mb-1 text-xs">
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <div className="truncate">{s.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Progress Percentage Bar */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span className="font-bold text-ink">Overall Progress</span>
                  <span className="font-bold text-cobalt">{repo.progressPercent}%</span>
                </div>
                <div className="w-full h-3 bg-surface-2 border-2 border-ink rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-cobalt rounded-full transition-all duration-300"
                    style={{ width: `${repo.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Ready Summary Banner */}
              {repo.stage === 'ready' && !repo.isColdStart && (
                <div className="p-4 bg-mint/20 border-2 border-mint rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-mint" />
                    <div>
                      <p className="text-xs font-bold text-ink">
                        {repo.bugfixCommits} bug-fix commits indexed, {repo.functionChunks} function chunks
                      </p>
                      <p className="text-[11px] text-muted">
                        Team institutional memory is active and ready for PR review.
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/"
                    className="btn-brutal inline-flex items-center gap-1.5 px-4 py-2 bg-cobalt text-white font-bold text-xs rounded-lg border-2 border-ink shadow-brutal-sm"
                  >
                    <span>View Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live Log Drawer Accordion */}
      <div className="bg-surface border-3 border-ink rounded-xl shadow-brutal overflow-hidden">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full p-4 bg-surface-2 border-b-2 border-ink flex items-center justify-between font-mono text-xs font-bold text-ink hover:bg-sand/40"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            <span>Live Indexing Stream Logs ({repos[0]?.logs.length || 0} events)</span>
          </div>
          <span>{showLogs ? 'Hide Logs ▲' : 'Show Logs ▼'}</span>
        </button>

        {showLogs && (
          <div className="p-4 bg-[#111111] text-paper font-mono text-xs max-h-60 overflow-y-auto space-y-1">
            {repos.flatMap((r) => r.logs).map((log, i) => (
              <div key={i} className="text-mint/90 whitespace-pre">
                {log}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between pt-2">
        <Link
          to="/onboarding/repos"
          className="text-xs text-muted hover:text-ink underline font-mono"
        >
          ← Back to Repositories
        </Link>

        <button
          onClick={() => navigate('/')}
          className="btn-brutal px-4 py-2 bg-surface text-ink border-2 border-ink rounded-lg font-bold text-xs shadow-brutal-sm hover:bg-sand"
        >
          Run in Background & Open Dashboard →
        </button>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Archive, 
  Lock, 
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Banner } from '../components/UIStates';

interface OnboardingRepoItem {
  id: string;
  name: string;
  languages: string[];
  lastCommit: string;
  commitCount: number;
  status: 'active' | 'archived' | 'no_permission';
  disabledReason?: string;
}

const SAMPLE_REPOS: OnboardingRepoItem[] = [
  {
    id: 'repo-1',
    name: 'campus-portal',
    languages: ['Python', 'TypeScript'],
    lastCommit: '2 hours ago',
    commitCount: 1420,
    status: 'active',
  },
  {
    id: 'repo-2',
    name: 'course-registration-api',
    languages: ['Python'],
    lastCommit: 'Yesterday',
    commitCount: 890,
    status: 'active',
  },
  {
    id: 'repo-3',
    name: 'exam-scheduler',
    languages: ['JavaScript', 'Node.js'],
    lastCommit: '3 days ago',
    commitCount: 450,
    status: 'active',
  },
  {
    id: 'repo-4',
    name: 'legacy-grades-db',
    languages: ['Python', 'SQL'],
    lastCommit: '8 months ago',
    commitCount: 2310,
    status: 'archived',
    disabledReason: 'Archived repository (read-only)',
  },
  {
    id: 'repo-5',
    name: 'alumni-network-core',
    languages: ['Go', 'TypeScript'],
    lastCommit: '1 week ago',
    commitCount: 670,
    status: 'no_permission',
    disabledReason: 'App lacks write/webhook permission in org',
  },
  {
    id: 'repo-6',
    name: 'mentorlens-demo',
    languages: ['Python'],
    lastCommit: 'Just now',
    commitCount: 38,
    status: 'active',
  },
];

export default function OnboardingReposPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>(['repo-1', 'repo-6']);
  const [page, setPage] = useState(1);
  const pageSize = 4;
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);

  const filtered = useMemo(() => {
    return SAMPLE_REPOS.filter((r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.languages.some((l) => l.toLowerCase().includes(search.toLowerCase()))
    );
  }, [search]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const pageRepos = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSelect = (id: string, status: string) => {
    if (status !== 'active') return;
    if (selectedRepoIds.includes(id)) {
      setSelectedRepoIds(selectedRepoIds.filter((item) => item !== id));
    } else {
      setSelectedRepoIds([...selectedRepoIds, id]);
    }
  };

  const handleContinue = () => {
    navigate('/onboarding/index');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* 3-Step Wizard Header Stepper */}
      <div className="bg-surface p-4 sm:p-6 rounded-xl border-3 border-ink shadow-brutal">
        <div className="flex items-center justify-between max-w-2xl mx-auto relative">
          {/* Step 1 */}
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

          {/* Step 2 (Active) */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-cobalt text-white font-bold flex items-center justify-center border-2 border-ink shadow-brutal-sm text-xs">
              2
            </div>
            <div>
              <p className="text-[11px] font-mono uppercase font-bold text-cobalt">Step 2</p>
              <p className="text-xs font-extrabold text-ink">Choose Repositories</p>
            </div>
          </div>

          <div className="flex-1 h-0.5 bg-ink/20 mx-4" />

          {/* Step 3 */}
          <div className="flex items-center gap-3 opacity-60">
            <div className="w-8 h-8 rounded-full bg-surface-2 text-ink font-bold flex items-center justify-center border-2 border-ink text-xs">
              3
            </div>
            <div>
              <p className="text-[11px] font-mono uppercase text-muted">Step 3</p>
              <p className="text-xs font-bold text-ink">Learn from History</p>
            </div>
          </div>
        </div>
      </div>

      {/* Demo State Simulators Banner */}
      <div className="p-2.5 bg-surface-2 border-2 border-dashed border-ink/40 rounded-lg flex items-center justify-between text-xs font-mono">
        <span className="text-muted">Simulate GitHub App state banners:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInstallBanner(!showInstallBanner)}
            className="px-2 py-0.5 bg-surface border border-ink rounded hover:bg-sand font-bold"
          >
            {showInstallBanner ? 'Hide App Banner' : 'Show App Not Installed'}
          </button>
          <button
            onClick={() => setShowPermissionBanner(!showPermissionBanner)}
            className="px-2 py-0.5 bg-surface border border-ink rounded hover:bg-sand font-bold"
          >
            {showPermissionBanner ? 'Hide Perms Banner' : 'Show Perms Changed'}
          </button>
        </div>
      </div>

      {/* Conditional Banners */}
      {showInstallBanner && (
        <Banner
          variant="warning"
          message="GitHub App is not installed on all requested organizations. Grant permissions to continue."
          actionLabel="Install GitHub App →"
          onAction={() => window.open('https://github.com/apps', '_blank')}
        />
      )}

      {showPermissionBanner && (
        <Banner
          variant="error"
          message="Repository permissions have changed. Some webhook subscriptions require re-authorization."
          actionLabel="Re-authorize App →"
          onAction={() => alert('Redirecting to GitHub re-authorization...')}
        />
      )}

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Repo Selector (2 Cols) */}
        <div className="lg:col-span-2 bg-surface p-5 sm:p-6 rounded-xl border-3 border-ink shadow-brutal space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-extrabold text-xl text-ink">Select Repositories to Mentor</h2>
              <p className="text-xs text-muted mt-0.5">
                MentorLens will index bug fixes and review newly opened pull requests.
              </p>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search repos or languages..."
                className="w-full pl-9 pr-3 py-1.5 bg-surface-2 border-2 border-ink rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-tangerine"
              />
            </div>
          </div>

          {/* Repo List Table */}
          <div className="border-2 border-ink rounded-lg overflow-hidden divide-y-2 divide-ink/15">
            {pageRepos.map((repo) => {
              const isSelected = selectedRepoIds.includes(repo.id);
              const isDisabled = repo.status !== 'active';

              return (
                <div
                  key={repo.id}
                  onClick={() => toggleSelect(repo.id, repo.status)}
                  className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                    isDisabled
                      ? 'bg-muted/10 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-cobalt/5 hover:bg-cobalt/10 cursor-pointer'
                      : 'hover:bg-sand/30 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={() => {}}
                      className="w-4 h-4 rounded border-2 border-ink text-cobalt focus:ring-tangerine cursor-pointer disabled:cursor-not-allowed"
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-ink">{repo.name}</span>
                        {repo.status === 'archived' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 bg-sun/20 border border-ink/40 rounded text-ink">
                            <Archive className="w-3 h-3" /> Archived
                          </span>
                        )}
                        {repo.status === 'no_permission' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 bg-coral/20 border border-ink/40 rounded text-coral">
                            <Lock className="w-3 h-3" /> No permission
                          </span>
                        )}
                      </div>

                      {isDisabled ? (
                        <p className="text-[11px] text-coral font-medium mt-0.5">
                          {repo.disabledReason}
                        </p>
                      ) : (
                        <div className="flex items-center gap-3 text-xs text-muted mt-1 font-mono">
                          <span>{repo.commitCount} commits</span>
                          <span>•</span>
                          <span>Updated {repo.lastCommit}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Languages */}
                  <div className="flex items-center gap-1.5">
                    {repo.languages.map((lang) => (
                      <span
                        key={lang}
                        className="text-[11px] font-mono px-2 py-0.5 bg-surface-2 border border-ink/30 rounded font-medium text-ink"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs font-mono pt-2">
            <span className="text-muted">
              Showing {pageRepos.length} of {filtered.length} repositories
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-brutal px-2.5 py-1 bg-surface border-2 border-ink rounded disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-brutal px-2.5 py-1 bg-surface border-2 border-ink rounded disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Summary Panel */}
        <div className="space-y-4">
          <div className="bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cobalt" />
              <h3 className="font-display font-extrabold text-lg text-ink">Indexing Plan</h3>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between p-2.5 bg-surface-2 border-2 border-ink rounded-lg">
                <span className="text-muted">Selected Repositories</span>
                <span className="font-bold text-ink">{selectedRepoIds.length}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-surface-2 border-2 border-ink rounded-lg">
                <span className="text-muted">Estimated Index Time</span>
                <span className="font-bold text-mint">~45 seconds</span>
              </div>
            </div>

            <div className="p-3 bg-sun/15 border-2 border-sun rounded-lg text-xs leading-relaxed">
              <p className="font-bold text-ink flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-ink" /> Supported Languages
              </p>
              <p className="text-muted">
                Only Python and JavaScript / TypeScript are analysed in this version. Other files are skipped automatically.
              </p>
            </div>

            <button
              onClick={handleContinue}
              disabled={selectedRepoIds.length === 0}
              className="btn-brutal w-full py-3 px-4 bg-cobalt text-white font-bold text-sm rounded-lg border-2 border-ink shadow-brutal disabled:opacity-50"
            >
              Continue to Indexing ({selectedRepoIds.length}) →
            </button>
          </div>

          <div className="text-center">
            <Link
              to="/login"
              className="text-xs text-muted hover:text-ink underline font-mono"
            >
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

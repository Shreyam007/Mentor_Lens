import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  GitPullRequest, 
  RotateCw, 
  Search, 
  Filter, 
  AlertCircle,
  FileCode,
  CheckCircle2,
  XCircle,
  Layers
} from 'lucide-react';
import { SeverityBadge } from '../components/Badges';
import { Skeleton, EmptyState } from '../components/UIStates';

export interface PRRowItem {
  id: string;
  number: number;
  title: string;
  author: string;
  avatar: string;
  headBranch: string;
  baseBranch: string;
  status: 'queued' | 'analysing' | 'reviewed' | 'needs_attention' | 'failed' | 'skipped' | 'partial';
  gate: 'passing' | 'blocking' | 'none';
  counts: { critical: number; warning: number; suggestion: number };
  updatedAt: string;
  specialState?: 'draft' | 'bot' | 'fork' | 'large_pr' | 'failed_run';
  specialNote?: string;
  filesReviewed?: { reviewed: number; total: number };
}

const SAMPLE_PRS: PRRowItem[] = [
  {
    id: 'pr-104',
    number: 104,
    title: 'feat: add student batch registration controller',
    author: 'Meera Sharma',
    avatar: 'MS',
    headBranch: 'feat/batch-reg',
    baseBranch: 'main',
    status: 'needs_attention',
    gate: 'blocking',
    counts: { critical: 1, warning: 2, suggestion: 1 },
    updatedAt: '12 min ago',
  },
  {
    id: 'pr-103',
    number: 103,
    title: 'fix: handle postgres cursor leak in exam export',
    author: 'Aarav Patel',
    avatar: 'AP',
    headBranch: 'fix/cursor-leak',
    baseBranch: 'main',
    status: 'reviewed',
    gate: 'passing',
    counts: { critical: 0, warning: 1, suggestion: 0 },
    updatedAt: '2 hours ago',
  },
  {
    id: 'pr-102',
    number: 102,
    title: 'refactor: session authentication middleware',
    author: 'Rohan Gupta',
    avatar: 'RG',
    headBranch: 'refactor/auth-session',
    baseBranch: 'main',
    status: 'reviewed',
    gate: 'passing',
    counts: { critical: 0, warning: 0, suggestion: 2 },
    updatedAt: 'Yesterday',
  },
  {
    id: 'pr-100',
    number: 100,
    title: 'WIP: revamp syllabus upload parser [Draft]',
    author: 'Ishita Roy',
    avatar: 'IR',
    headBranch: 'wip/upload-parser',
    baseBranch: 'main',
    status: 'skipped',
    gate: 'none',
    counts: { critical: 0, warning: 0, suggestion: 0 },
    updatedAt: '3 hours ago',
    specialState: 'draft',
    specialNote: 'Draft — skipped review per repository settings',
  },
  {
    id: 'pr-99',
    number: 99,
    title: 'build(deps): bump urllib3 from 2.0.7 to 2.2.1',
    author: 'dependabot[bot]',
    avatar: 'DB',
    headBranch: 'dependabot/urllib3',
    baseBranch: 'main',
    status: 'skipped',
    gate: 'none',
    counts: { critical: 0, warning: 0, suggestion: 0 },
    updatedAt: 'Yesterday',
    specialState: 'bot',
    specialNote: 'Skipped: bot author ignored',
  },
  {
    id: 'pr-98',
    number: 98,
    title: 'contrib: add dark mode theme toggle from fork',
    author: 'external-contributor',
    avatar: 'EC',
    headBranch: 'ext:patch-1',
    baseBranch: 'main',
    status: 'reviewed',
    gate: 'passing',
    counts: { critical: 0, warning: 1, suggestion: 1 },
    updatedAt: '2 days ago',
    specialState: 'fork',
    specialNote: 'Limited: fork permissions (read-only token)',
  },
  {
    id: 'pr-97',
    number: 97,
    title: 'refactor: monorepo migration and shared libs',
    author: 'Rohan Gupta',
    avatar: 'RG',
    headBranch: 'monorepo-migration',
    baseBranch: 'main',
    status: 'partial',
    gate: 'passing',
    counts: { critical: 0, warning: 3, suggestion: 4 },
    updatedAt: '3 days ago',
    specialState: 'large_pr',
    specialNote: 'Partially reviewed: 40 of 212 files (file size budget reached)',
    filesReviewed: { reviewed: 40, total: 212 },
  },
  {
    id: 'pr-96',
    number: 96,
    title: 'feat: payment gateway webhook integration',
    author: 'Meera Sharma',
    avatar: 'MS',
    headBranch: 'feat/stripe-webhook',
    baseBranch: 'main',
    status: 'failed',
    gate: 'blocking',
    counts: { critical: 0, warning: 0, suggestion: 0 },
    updatedAt: '4 days ago',
    specialState: 'failed_run',
    specialNote: 'Pipeline timeout during Retriever step (LLM gateway 504)',
  },
];

export default function PRQueuePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters from query params
  const activeTab = searchParams.get('tab') || 'all';
  const authorFilter = searchParams.get('author') || '';
  const severityFilter = searchParams.get('severity') || '';
  const searchFilter = searchParams.get('q') || '';
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const setFilterParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (!val || val === 'all') {
      next.delete(key);
    } else {
      next.set(key, val);
    }
    setSearchParams(next);
    setPage(1);
  };

  const filtered = useMemo(() => {
    return SAMPLE_PRS.filter((pr) => {
      // Tab filter
      if (activeTab === 'reviewing' && pr.status !== 'analysing' && pr.status !== 'queued') return false;
      if (activeTab === 'reviewed' && pr.status !== 'reviewed' && pr.status !== 'partial') return false;
      if (activeTab === 'blocked' && pr.gate !== 'blocking') return false;
      if (activeTab === 'failed' && pr.status !== 'failed') return false;

      // Author filter
      if (authorFilter && !pr.author.toLowerCase().includes(authorFilter.toLowerCase())) return false;

      // Severity filter
      if (severityFilter === 'critical' && pr.counts.critical === 0) return false;
      if (severityFilter === 'warning' && pr.counts.warning === 0) return false;
      if (severityFilter === 'clean' && (pr.counts.critical > 0 || pr.counts.warning > 0 || pr.counts.suggestion > 0)) return false;

      // Search query filter
      if (searchFilter) {
        const query = searchFilter.toLowerCase();
        const matchesTitle = pr.title.toLowerCase().includes(query);
        const matchesBranch = pr.headBranch.toLowerCase().includes(query);
        const matchesNumber = pr.number.toString().includes(query);
        if (!matchesTitle && !matchesBranch && !matchesNumber) return false;
      }

      return true;
    });
  }, [activeTab, authorFilter, severityFilter, searchFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
    setPage(1);
  };

  const statusPills: Record<PRRowItem['status'], { label: string; bg: string }> = {
    queued: { label: 'Queued', bg: 'bg-surface-2 border-ink text-muted' },
    analysing: { label: 'Analysing...', bg: 'bg-sun/20 border-sun text-ink animate-pulse' },
    reviewed: { label: 'Reviewed', bg: 'bg-mint/20 border-mint text-ink font-bold' },
    needs_attention: { label: 'Needs Attention', bg: 'bg-coral/20 border-coral text-coral font-bold' },
    failed: { label: 'Failed', bg: 'bg-coral text-white border-ink font-bold' },
    skipped: { label: 'Skipped', bg: 'bg-surface-2 border-ink/40 text-muted' },
    partial: { label: 'Partially Reviewed', bg: 'bg-sky/20 border-sky text-ink font-bold' },
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-ink">Pull Request Queue</h1>
          <p className="text-xs text-muted">
            Monitored pull requests on <span className="font-mono font-bold text-ink">campus-portal</span>
          </p>
        </div>

        {/* State Simulator */}
        <button
          onClick={() => {
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 800);
          }}
          className="px-3 py-1 bg-surface-2 border-2 border-ink rounded-lg font-mono text-xs font-bold shadow-brutal-sm hover:bg-sand"
        >
          Simulate Loading Skeleton
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b-2 border-ink pb-2">
        {[
          { key: 'all', label: 'All PRs', count: SAMPLE_PRS.length },
          { key: 'reviewing', label: 'Reviewing', count: 0 },
          { key: 'reviewed', label: 'Reviewed', count: 4 },
          { key: 'blocked', label: 'Blocked by Gate', count: 2 },
          { key: 'failed', label: 'Failed Runs', count: 1 },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilterParam('tab', tab.key)}
              className={`px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-cobalt text-white border-ink shadow-brutal-sm'
                  : 'bg-surface text-ink border-transparent hover:border-ink/30 hover:bg-surface-2'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                isActive ? 'bg-white text-cobalt border-ink' : 'bg-surface-2 text-muted border-ink/20'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="bg-surface p-4 rounded-xl border-3 border-ink shadow-brutal flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setFilterParam('q', e.target.value)}
              placeholder="Search by title, #ID, branch..."
              className="w-full pl-9 pr-3 py-1.5 bg-surface-2 border-2 border-ink rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-tangerine"
            />
          </div>

          {/* Author Filter */}
          <select
            value={authorFilter}
            onChange={(e) => setFilterParam('author', e.target.value)}
            className="px-3 py-1.5 bg-surface-2 border-2 border-ink rounded-lg text-xs font-mono font-medium text-ink"
          >
            <option value="">All Authors</option>
            <option value="Meera">Meera Sharma</option>
            <option value="Aarav">Aarav Patel</option>
            <option value="Rohan">Rohan Gupta</option>
            <option value="Ishita">Ishita Roy</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setFilterParam('severity', e.target.value)}
            className="px-3 py-1.5 bg-surface-2 border-2 border-ink rounded-lg text-xs font-mono font-medium text-ink"
          >
            <option value="">All Severities</option>
            <option value="critical">Has Critical</option>
            <option value="warning">Has Warnings</option>
            <option value="clean">Clean (0 Findings)</option>
          </select>
        </div>

        {/* Clear filters button if any active */}
        {(activeTab !== 'all' || authorFilter || severityFilter || searchFilter) && (
          <button
            onClick={clearFilters}
            className="text-xs font-mono text-coral font-bold hover:underline flex items-center gap-1"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Clear filters</span>
          </button>
        )}
      </div>

      {/* Main Table or Loading Skeleton or Empty State */}
      {isLoading ? (
        <div className="bg-surface border-3 border-ink rounded-xl shadow-brutal p-6 space-y-4">
          <Skeleton className="h-8 w-1/3 mb-4" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : paginated.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No pull requests match filters"
          description="Try broadening your filter criteria or reset to view all pull requests."
          actionLabel="Reset All Filters"
          onAction={clearFilters}
        />
      ) : (
        <div className="bg-surface border-3 border-ink rounded-xl shadow-brutal overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-2 border-b-2 border-ink text-ink font-mono uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="p-3 font-bold">Pull Request</th>
                  <th className="p-3 font-bold">Branches</th>
                  <th className="p-3 font-bold">Author</th>
                  <th className="p-3 font-bold">Status</th>
                  <th className="p-3 font-bold">Findings</th>
                  <th className="p-3 font-bold">PR Gate</th>
                  <th className="p-3 font-bold text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-ink/15 font-mono">
                {paginated.map((pr) => {
                  const isGreyed = pr.specialState === 'draft' || pr.specialState === 'bot';

                  return (
                    <tr
                      key={pr.id}
                      onClick={() => navigate(`/prs/${pr.id}`)}
                      className={`hover:bg-sand/30 cursor-pointer transition-colors ${
                        isGreyed ? 'bg-surface-2/40 opacity-75' : ''
                      }`}
                    >
                      {/* PR Title + ID */}
                      <td className="p-3 max-w-sm">
                        <div className="flex items-start gap-2">
                          <GitPullRequest className="w-4 h-4 text-cobalt shrink-0 mt-0.5" />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-ink">#{pr.number}</span>
                              <span className="font-sans text-xs font-semibold text-ink hover:underline">
                                {pr.title}
                              </span>
                            </div>

                            {/* Special State note */}
                            {pr.specialNote && (
                              <p className="text-[10px] font-sans font-medium text-muted mt-0.5 flex items-center gap-1">
                                {pr.specialState === 'failed_run' ? (
                                  <AlertCircle className="w-3 h-3 text-coral inline" />
                                ) : pr.specialState === 'large_pr' ? (
                                  <Layers className="w-3 h-3 text-sky inline" />
                                ) : (
                                  <FileCode className="w-3 h-3 text-muted inline" />
                                )}
                                <span>{pr.specialNote}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Branches */}
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="px-1.5 py-0.5 bg-surface-2 border border-ink/30 rounded text-ink">
                            {pr.headBranch}
                          </span>
                          <span className="text-muted">→</span>
                          <span className="px-1.5 py-0.5 bg-surface-2 border border-ink/30 rounded text-muted">
                            {pr.baseBranch}
                          </span>
                        </div>
                      </td>

                      {/* Author */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded bg-tangerine text-white text-[9px] font-bold flex items-center justify-center border border-ink">
                            {pr.avatar}
                          </span>
                          <span className="font-sans text-xs font-medium text-ink truncate max-w-[100px]">
                            {pr.author}
                          </span>
                        </div>
                      </td>

                      {/* Status Pill */}
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] border-2 rounded ${statusPills[pr.status].bg}`}>
                          {statusPills[pr.status].label}
                        </span>
                      </td>

                      {/* Findings Badges */}
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {pr.counts.critical > 0 && <SeverityBadge severity="critical" />}
                          {pr.counts.warning > 0 && <SeverityBadge severity="warning" />}
                          {pr.counts.suggestion > 0 && <SeverityBadge severity="suggestion" />}
                          {pr.counts.critical === 0 && pr.counts.warning === 0 && pr.counts.suggestion === 0 && (
                            <span className="text-[10px] text-muted">0 findings</span>
                          )}
                        </div>
                      </td>

                      {/* Gate Chip */}
                      <td className="p-3">
                        {pr.gate === 'blocking' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-coral/20 border-2 border-coral rounded text-[10px] font-bold text-coral">
                            <XCircle className="w-3 h-3" />
                            <span>Gate: Blocking</span>
                          </span>
                        ) : pr.gate === 'passing' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-mint/20 border-2 border-mint rounded text-[10px] font-bold text-ink">
                            <CheckCircle2 className="w-3 h-3 text-mint" />
                            <span>Gate: Passing</span>
                          </span>
                        ) : (
                          <span className="text-muted text-[10px]">—</span>
                        )}
                      </td>

                      {/* Updated time + Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2 text-muted text-[11px]">
                          <span>{pr.updatedAt}</span>
                          {pr.specialState === 'failed_run' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                alert('Triggering review retry via /api/runs/retry...');
                              }}
                              className="btn-brutal px-2 py-0.5 bg-surface text-ink border border-ink rounded text-[10px] font-bold shadow-brutal-sm hover:bg-sand"
                              title="Retry review"
                            >
                              <RotateCw className="w-3 h-3 inline mr-1" />
                              Retry
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination & Page Size */}
          <div className="p-3 bg-surface-2 border-t-2 border-ink flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="text-muted">
                Showing {paginated.length} of {filtered.length} pull requests
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-muted">Page size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-surface border-2 border-ink rounded px-1.5 py-0.5 font-bold"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-brutal px-3 py-1 bg-surface border-2 border-ink rounded font-bold disabled:opacity-40"
              >
                Previous
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-brutal px-3 py-1 bg-surface border-2 border-ink rounded font-bold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { 
  Search, 
  RotateCw, 
  Clock, 
  Database, 
  AlertTriangle, 
  GitPullRequest, 
  Trash2, 
  ExternalLink,
  Filter
} from 'lucide-react';
import { ShaChip } from '../components/Badges';
import { EmptyState, ConfirmDialog } from '../components/UIStates';

interface MemoryCardItem {
  id: string;
  sha: string;
  message: string;
  category: string;
  author: string;
  date: string;
  file: string;
  functionName: string;
  timesCited: number;
  beforeSnippet: string;
  afterSnippet: string;
  fullDiff: string;
  linkedPRs: Array<{ number: number; title: string }>;
  isExcluded: boolean;
  isStale?: boolean; // history rewritten on GitHub
}

const SAMPLE_MEMORY: MemoryCardItem[] = [
  {
    id: 'mem-1',
    sha: 'a3f21c9',
    message: 'fix: sanitize student sql query in portal auth and controllers',
    category: 'SQL Injection',
    author: 'Aarav Patel',
    date: '3 weeks ago',
    file: 'campus_portal/controllers/registration.py',
    functionName: 'get_student_records',
    timesCited: 7,
    beforeSnippet: `query = f"SELECT * FROM registrations WHERE id = '{student_id}'"`,
    afterSnippet: `query = "SELECT * FROM registrations WHERE id = %s"\nreturn self.db.execute(query, (student_id,))`,
    fullDiff: `@@ -40,4 +40,5 @@ class RegistrationController:
-        query = f"SELECT * FROM registrations WHERE id = '{student_id}'"
-        return self.db.execute(query)
+        query = "SELECT * FROM registrations WHERE id = %s"
+        return self.db.execute(query, (student_id,))`,
    linkedPRs: [
      { number: 104, title: 'feat: add student batch registration controller' },
      { number: 89, title: 'feat: student transcript export api' },
    ],
    isExcluded: false,
  },
  {
    id: 'mem-2',
    sha: 'd7e108f',
    message: 'fix: avoid mutable default list in exam schedule course batching',
    category: 'Mutable Default Argument',
    author: 'Rohan Gupta',
    date: '1 month ago',
    file: 'campus_portal/services/scheduler.py',
    functionName: 'schedule_courses',
    timesCited: 4,
    beforeSnippet: `def schedule_courses(courses: list = []):`,
    afterSnippet: `def schedule_courses(courses: list = None):\n    if courses is None: courses = []`,
    fullDiff: `@@ -12,3 +12,4 @@
-def schedule_courses(courses: list = []):
+def schedule_courses(courses: list = None):
+    if courses is None:
+        courses = []`,
    linkedPRs: [
      { number: 104, title: 'feat: add student batch registration controller' },
    ],
    isExcluded: false,
  },
  {
    id: 'mem-3',
    sha: 'b8210fe',
    message: 'fix: close open file handle in grade certificate export stream',
    category: 'Unclosed File Handle',
    author: 'Ishita Roy',
    date: '2 months ago',
    file: 'campus_portal/utils/reports.py',
    functionName: 'export_certificate',
    timesCited: 5,
    beforeSnippet: `f = open(path, "rb")\nreturn f.read()`,
    afterSnippet: `with open(path, "rb") as f:\n    return f.read()`,
    fullDiff: `@@ -88,3 +88,3 @@
-    f = open(path, "rb")
-    return f.read()
+    with open(path, "rb") as f:
+        return f.read()`,
    linkedPRs: [
      { number: 95, title: 'feat: semester grade report card generation' },
    ],
    isExcluded: false,
  },
  {
    id: 'mem-4',
    sha: 'c1998af',
    message: 'fix: rotate leaked test stripe webhook secret key',
    category: 'Hardcoded Secret',
    author: 'Aarav Patel',
    date: '3 months ago',
    file: 'campus_portal/config/payment.py',
    functionName: 'get_stripe_key',
    timesCited: 2,
    beforeSnippet: `STRIPE_KEY = "sk_live_98124018240"`,
    afterSnippet: `STRIPE_KEY = os.environ["STRIPE_API_KEY"]`,
    fullDiff: `@@ -5,2 +5,2 @@
-STRIPE_KEY = "sk_live_98124018240"
+STRIPE_KEY = os.environ["STRIPE_API_KEY"]`,
    linkedPRs: [],
    isExcluded: false,
    isStale: true,
  },
];

export default function MemoryExplorerPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [items, setItems] = useState<MemoryCardItem[]>(SAMPLE_MEMORY);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(SAMPLE_MEMORY[0].id);
  const [isSyncing, setIsSyncing] = useState(false);
  const [confirmExcludeId, setConfirmExcludeId] = useState<string | null>(null);

  // Natural language & keyword filtering
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory && item.category !== selectedCategory) return false;
      if (selectedAuthor && item.author !== selectedAuthor) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesMsg = item.message.toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        const matchesFile = item.file.toLowerCase().includes(q);
        const matchesSha = item.sha.toLowerCase().includes(q);
        if (!matchesMsg && !matchesCat && !matchesFile && !matchesSha) return false;
      }
      return true;
    });
  }, [items, search, selectedCategory, selectedAuthor]);

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      alert('Team memory synced with remote GitHub commits.');
    }, 1200);
  };

  const handleToggleExclude = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isExcluded: !i.isExcluded } : i))
    );
    setConfirmExcludeId(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Freshness Chip */}
      <div className="bg-surface p-5 sm:p-6 rounded-xl border-3 border-ink shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5 text-cobalt" />
            <h1 className="font-display font-extrabold text-2xl text-ink">Team Memory Explorer</h1>
          </div>
          <p className="text-xs text-muted">
            Searchable institutional repository history powering citation retrieval.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border-2 border-ink rounded-lg font-mono text-xs shadow-brutal-sm">
            <Clock className="w-3.5 h-3.5 text-muted" />
            <span>Last synced 4 min ago</span>
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="btn-brutal inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-cobalt text-white border-2 border-ink rounded-lg text-xs font-bold shadow-brutal-sm disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Re-sync Memory'}</span>
          </button>
        </div>
      </div>

      {/* Large Search Input & Filters */}
      <div className="bg-surface p-4 rounded-xl border-3 border-ink shadow-brutal space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 text-muted absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search past mistakes, e.g. 'unclosed file', 'SQL query', 'mutable default'..."
            className="w-full pl-11 pr-4 py-3 bg-surface-2 border-2 border-ink rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-tangerine"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
          <span className="text-muted text-[11px] flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter by:
          </span>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1 bg-surface-2 border-2 border-ink rounded-lg"
          >
            <option value="">All Categories</option>
            <option value="SQL Injection">SQL Injection</option>
            <option value="Mutable Default Argument">Mutable Default Argument</option>
            <option value="Unclosed File Handle">Unclosed File Handle</option>
            <option value="Hardcoded Secret">Hardcoded Secret</option>
          </select>

          <select
            value={selectedAuthor}
            onChange={(e) => setSelectedAuthor(e.target.value)}
            className="px-2.5 py-1 bg-surface-2 border-2 border-ink rounded-lg"
          >
            <option value="">All Authors</option>
            <option value="Aarav Patel">Aarav Patel</option>
            <option value="Rohan Gupta">Rohan Gupta</option>
            <option value="Ishita Roy">Ishita Roy</option>
          </select>

          {(search || selectedCategory || selectedAuthor) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('');
                setSelectedAuthor('');
              }}
              className="text-xs text-coral underline hover:no-underline font-bold ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column: Results List (Left) + Detail Drawer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Results Column (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-muted px-1">
            <span>Found {filteredItems.length} indexed bug-fix commits</span>
            <span>Click card to inspect full commit diff</span>
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No memory items found"
              description="No past bug fixes match your query. Try searching for different keywords or reset filters."
              actionLabel="Clear Search"
              onAction={() => setSearch('')}
            />
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedItemId === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`bg-surface p-5 rounded-xl border-3 transition-all cursor-pointer space-y-3 ${
                    isSelected
                      ? 'border-cobalt shadow-brutal ring-2 ring-cobalt/30'
                      : 'border-ink shadow-brutal-sm hover:border-ink hover:shadow-brutal'
                  }`}
                >
                  {/* Card Top Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ShaChip sha={item.sha} />
                      <span className="px-2 py-0.5 bg-surface-2 border border-ink/40 rounded font-mono text-[10px] font-bold text-ink">
                        {item.category}
                      </span>
                      {item.isStale && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sun/20 border border-sun text-ink rounded font-mono text-[10px] font-bold">
                          <AlertTriangle className="w-3 h-3 text-ink" />
                          Commit rewritten on GitHub
                        </span>
                      )}
                      {item.isExcluded && (
                        <span className="px-2 py-0.5 bg-coral/20 border border-coral text-coral rounded font-mono text-[10px] font-bold">
                          Excluded from Memory
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-mono text-muted shrink-0">
                      Cited in <strong>{item.timesCited}</strong> reviews
                    </span>
                  </div>

                  {/* Commit Message */}
                  <h3 className="font-sans font-bold text-sm text-ink leading-snug">
                    {item.message}
                  </h3>

                  {/* File & Function */}
                  <div className="text-xs font-mono text-muted flex items-center gap-2">
                    <span className="text-ink font-semibold">{item.file}</span>
                    <span>•</span>
                    <span>fn: {item.functionName}()</span>
                  </div>

                  {/* Before / After Mini-Diff Preview */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                    <div className="p-2.5 bg-coral/10 border border-coral/30 rounded text-ink overflow-x-hidden">
                      <span className="text-[9px] uppercase font-bold text-coral block mb-1">
                        - Before (Vulnerable)
                      </span>
                      <pre className="whitespace-pre-wrap truncate">{item.beforeSnippet}</pre>
                    </div>

                    <div className="p-2.5 bg-mint/15 border border-mint/30 rounded text-ink overflow-x-hidden">
                      <span className="text-[9px] uppercase font-bold text-mint block mb-1">
                        + After (Fixed)
                      </span>
                      <pre className="whitespace-pre-wrap truncate">{item.afterSnippet}</pre>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Commit Full Inspector Drawer (5 Cols) */}
        <div className="lg:col-span-5 bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-4 lg:sticky lg:top-20">
          {selectedItem ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShaChip sha={selectedItem.sha} />
                  <span className="text-xs font-mono font-bold text-ink">Commit Inspector</span>
                </div>

                <a
                  href={`https://github.com/campus-portal/commit/${selectedItem.sha}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-mono text-cobalt hover:underline inline-flex items-center gap-1"
                >
                  <span>GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Message */}
              <div>
                <h3 className="font-display font-extrabold text-base text-ink">
                  {selectedItem.message}
                </h3>
                <p className="text-xs font-mono text-muted mt-1">
                  Authored by {selectedItem.author} • {selectedItem.date}
                </p>
              </div>

              {/* Stale Warning Action */}
              {selectedItem.isStale && (
                <div className="p-3 bg-sun/15 border-2 border-sun rounded-lg space-y-1.5 text-xs font-mono">
                  <p className="font-bold text-ink flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Commit no longer exists on GitHub
                  </p>
                  <p className="text-muted text-[11px]">
                    Git history may have been rebased or rewritten. Re-sync to verify remote existence.
                  </p>
                  <button
                    onClick={handleSync}
                    className="btn-brutal px-2.5 py-1 bg-surface border border-ink rounded font-bold text-xs shadow-brutal-sm"
                  >
                    Re-sync Stale Item
                  </button>
                </div>
              )}

              {/* Full Diff Patch */}
              <div>
                <p className="text-xs font-mono font-bold text-ink mb-1.5">
                  Full Unified Patch ({selectedItem.file})
                </p>
                <pre className="p-3 bg-[#111111] text-paper rounded-lg border-2 border-ink text-[11px] font-mono overflow-x-auto max-h-56">
                  {selectedItem.fullDiff}
                </pre>
              </div>

              {/* Linked PRs where cited */}
              <div className="space-y-2 pt-2 border-t-2 border-ink/15">
                <p className="text-xs font-mono font-bold text-ink flex items-center gap-1.5">
                  <GitPullRequest className="w-3.5 h-3.5 text-cobalt" />
                  <span>Linked PRs Where Cited ({selectedItem.linkedPRs.length})</span>
                </p>

                {selectedItem.linkedPRs.length === 0 ? (
                  <p className="text-xs font-mono text-muted">Not yet cited in reviewed PRs.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedItem.linkedPRs.map((pr) => (
                      <div
                        key={pr.number}
                        className="p-2 bg-surface-2 border border-ink/30 rounded text-xs font-mono flex items-center justify-between"
                      >
                        <span className="font-bold">#{pr.number}</span>
                        <span className="truncate max-w-[200px] text-muted">{pr.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Exclude Toggle with Confirmation */}
              <div className="pt-3 border-t-2 border-ink/15">
                <button
                  onClick={() => setConfirmExcludeId(selectedItem.id)}
                  className={`btn-brutal w-full py-2 px-3 rounded-lg border-2 border-ink text-xs font-bold shadow-brutal-sm flex items-center justify-center gap-2 ${
                    selectedItem.isExcluded
                      ? 'bg-mint text-ink'
                      : 'bg-coral/20 text-coral hover:bg-coral hover:text-white'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {selectedItem.isExcluded
                      ? 'Re-enable in Team Memory'
                      : 'Exclude from Team Memory'}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted text-center py-12">
              Select a memory item to view its diff and citation history.
            </p>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Exclude */}
      <ConfirmDialog
        isOpen={!!confirmExcludeId}
        title="Exclude Commit from Team Memory?"
        message="Excluding this commit prevents MentorLens from citing it in future PR reviews. You can re-enable it at any time."
        confirmLabel="Exclude Commit"
        isDestructive={true}
        onConfirm={() => confirmExcludeId && handleToggleExclude(confirmExcludeId)}
        onCancel={() => setConfirmExcludeId(null)}
      />
    </div>
  );
}

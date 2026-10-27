import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  GitPullRequest, 
  RotateCw, 
  ExternalLink, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { DiffViewer } from '../components/DiffViewer';
import { SeverityBadge } from '../components/Badges';
import { Skeleton } from '../components/UIStates';

export default function PRReviewDetailPage() {
  const { id } = useParams();
  const [activeFrame, setActiveFrame] = useState<'default' | 'no_citation' | 'citation_removed' | 'in_progress' | 'failed' | 'outdated'>('default');

  // Sample PR Diff files with unified diff patch
  const diffFiles = [
    {
      filename: 'campus_portal/controllers/registration.py',
      status: 'modified',
      additions: 18,
      deletions: 4,
      patch: `@@ -40,10 +40,18 @@ class RegistrationController:
     def get_student_records(self, student_id: str):
         # Fetch user enrollment information
-        query = "SELECT * FROM registrations WHERE student_id = %s"
-        return self.db.execute(query, (student_id,))
+        # Vulnerable string formatting:
+        query = f"SELECT * FROM registrations WHERE student_id = '{student_id}'"
+        return self.db.execute(query)
+
+    def register_courses(self, student_id: str, course_codes: list = []):
+        # Register student for semester courses
+        registered = []
+        for code in course_codes:
+            self.db.insert("enrollments", student_id=student_id, course=code)
+            registered.append(code)
+        return registered`,
    },
    {
      filename: 'campus_portal/services/cache.py',
      status: 'modified',
      additions: 6,
      deletions: 1,
      patch: `@@ -15,6 +15,7 @@ def get_cache_client():
     # Connect to redis instance
     redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
+    client = redis.from_url(redis_url)
     return client`,
    },
  ];

  // Sample findings for the diff
  const baseFindings = [
    {
      id: 'f-1',
      file_path: 'campus_portal/controllers/registration.py',
      line_start: 45,
      line_end: 45,
      category: 'SQL Injection',
      severity: 'critical' as const,
      title: 'Possible SQL Injection via String Interpolation',
      why_risky:
        'Using Python f-strings to format untrusted parameters directly into raw SQL queries allows attackers to bypass authentication or access records of any student via SQL injection payloads (e.g. `1\' OR \'1\'=\'1`).',
      fix: 'Use parameterized queries with parameterized placeholders so the database driver escapes user inputs safely.',
      suggested_code: `query = "SELECT * FROM registrations WHERE student_id = %s"\nreturn self.db.execute(query, (student_id,))`,
      status: 'open' as const,
      citations: [
        {
          sha: 'a3f21c9',
          verdict: 'approved' as const,
          similarity: 0.88,
          reason: 'Touches exact query pattern in registration.py with commit message "fix: sanitize sql query in portal auth"',
        },
      ],
    },
    {
      id: 'f-2',
      file_path: 'campus_portal/controllers/registration.py',
      line_start: 48,
      line_end: 48,
      category: 'Mutable Default Argument',
      severity: 'warning' as const,
      title: 'Mutable Default Argument in Function Definition',
      why_risky:
        'Python creates default argument lists once at function definition time. Subsequent invocations that append to `course_codes` will modify the shared list across all student registrations.',
      fix: 'Use `course_codes: list = None` as the default argument, and initialize a new list inside the function body.',
      suggested_code: `def register_courses(self, student_id: str, course_codes: list = None):\n    if course_codes is None:\n        course_codes = []`,
      status: 'open' as const,
      citations: [
        {
          sha: 'd7e108f',
          verdict: 'approved' as const,
          similarity: 0.91,
          reason: 'Matches fix in exam_scheduler where mutable list leaked state across sessions',
        },
      ],
    },
  ];

  // Adjust findings based on selected frame variant
  const findings = baseFindings.map((f, idx) => {
    if (activeFrame === 'no_citation') {
      return { ...f, citations: [] };
    }
    if (activeFrame === 'citation_removed' && idx === 0) {
      return {
        ...f,
        citations: [
          {
            sha: '9999999',
            verdict: 'citation_stripped' as const,
            similarity: 0.31,
            reason: 'Verifier rejected: cited commit does not touch SQL query mechanics (1 unverifiable reference was removed)',
          },
        ],
      };
    }
    if (activeFrame === 'outdated') {
      return {
        ...f,
        status: 'outdated' as const,
      };
    }
    return f;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Frame Switcher Bar for Demo & Evaluation */}
      <div className="p-3 bg-surface-2 border-2 border-dashed border-ink/40 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <span className="text-muted">Test S06 Alternate Frames:</span>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['default', 'Default (Verified)'],
              ['no_citation', 'No Citation Found'],
              ['citation_removed', 'Citation Stripped by Verifier'],
              ['in_progress', 'Review in Progress'],
              ['failed', 'Review Failed'],
              ['outdated', 'Outdated (Code Changed)'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveFrame(key)}
              className={`px-2.5 py-1 rounded border-2 border-ink font-bold ${
                activeFrame === key
                  ? 'bg-cobalt text-white shadow-brutal-sm'
                  : 'bg-surface text-ink hover:bg-sand'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main PR Header */}
      <div className="bg-surface p-5 sm:p-6 rounded-xl border-3 border-ink shadow-brutal space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-surface-2 border-2 border-ink rounded font-mono text-xs font-bold text-ink">
                <GitPullRequest className="w-3.5 h-3.5 text-cobalt" />
                #{id || 104}
              </span>
              <h1 className="font-display font-extrabold text-2xl text-ink">
                feat: add student batch registration controller
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted">
              <span>Author: <strong className="text-ink">Meera Sharma</strong></span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-surface-2 border border-ink/30 rounded text-ink">
                  feat/batch-reg
                </span>
                <span>→</span>
                <span className="px-1.5 py-0.5 bg-surface-2 border border-ink/30 rounded text-muted">
                  main
                </span>
              </div>
              <span>•</span>
              <span>Commit <code className="text-ink font-bold">4a9b2ef</code></span>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-coral/15 border-2 border-coral rounded-lg font-mono text-xs font-bold text-coral">
              <XCircle className="w-4 h-4" />
              <span>Gate: Blocking on Critical</span>
            </span>

            <button
              onClick={() => alert('Triggering review re-run...')}
              className="btn-brutal inline-flex items-center gap-1.5 px-3.5 py-2 bg-surface text-ink border-2 border-ink rounded-lg font-bold text-xs shadow-brutal-sm hover:bg-sand"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Re-run Review</span>
            </button>

            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="btn-brutal inline-flex items-center gap-1.5 px-3.5 py-2 bg-cobalt text-white border-2 border-ink rounded-lg font-bold text-xs shadow-brutal-sm"
            >
              <span>Open on GitHub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Alternate Frame States */}
      {activeFrame === 'in_progress' ? (
        <div className="bg-surface p-8 rounded-xl border-3 border-ink shadow-brutal space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sun/30 border-2 border-ink flex items-center justify-center animate-spin">
              <RotateCw className="w-5 h-5 text-ink" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-lg text-ink">Review in Progress...</h3>
              <p className="text-xs text-muted font-mono">
                Running Multi-Agent Pipeline: Stage 3 of 4 (Retriever agent searching ChromaDB team memory)
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      ) : activeFrame === 'failed' ? (
        <div className="bg-coral/10 border-3 border-coral p-6 rounded-xl shadow-brutal space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded bg-coral text-white font-bold flex items-center justify-center text-xl shrink-0 border-2 border-ink">
              !
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-extrabold text-lg text-ink">Review Pipeline Failed</h3>
              <p className="text-xs text-ink leading-relaxed">
                The agent pipeline timed out while querying the LLM provider (Gateway 504).
                Static analysis findings were preserved, but history citations could not be synthesized.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setActiveFrame('default')}
                  className="btn-brutal px-4 py-1.5 bg-surface text-ink font-bold text-xs rounded border-2 border-ink shadow-brutal-sm"
                >
                  <RotateCw className="w-3.5 h-3.5 inline mr-1" />
                  Retry Review Run
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 2-Column HERO Layout: 65% Diff Viewer + 35% Sticky Summary Side Panel */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (65% -> 8 of 12 cols): Unified Diff Viewer with Inline Comments */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono px-1">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cobalt" />
                <span className="font-bold text-ink">2 Changed Files</span>
                <span className="text-muted">(24 additions, 5 deletions)</span>
              </div>
              <span className="text-muted">Click code lines to view unified diff context</span>
            </div>

            {/* Unified Diff Viewer Component */}
            <DiffViewer files={diffFiles} findings={findings} />
          </div>

          {/* Right Column (35% -> 4 of 12 cols): Sticky Summary Side Panel */}
          <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-20">
            {/* Review Summary Card */}
            <div className="bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-extrabold text-lg text-ink">Review Summary</h3>
                <span className="px-2 py-0.5 bg-coral/20 border border-coral text-coral rounded text-[10px] font-mono font-bold">
                  Action Required
                </span>
              </div>

              {/* Severity Breakdown */}
              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between p-2 bg-coral/10 border-2 border-coral rounded-lg">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity="critical" />
                  </div>
                  <span className="font-bold text-coral">1 Finding</span>
                </div>

                <div className="flex items-center justify-between p-2 bg-sun/15 border-2 border-sun rounded-lg">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity="warning" />
                  </div>
                  <span className="font-bold text-ink">1 Finding</span>
                </div>

                <div className="flex items-center justify-between p-2 bg-sky/15 border-2 border-sky rounded-lg">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity="suggestion" />
                  </div>
                  <span className="font-bold text-ink">0 Findings</span>
                </div>
              </div>

              {/* Skill Calibration Chip with Popover explanation */}
              <div className="p-3 bg-surface-2 border-2 border-ink rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-muted">Audience calibration:</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cobalt text-white border border-ink rounded text-[11px] font-mono font-bold">
                    <Sparkles className="w-3 h-3" />
                    Intermediate
                  </span>
                </div>
                <p className="text-[10px] text-muted leading-relaxed">
                  Calibrated for Meera (Level 2). Comments include architectural context and institutional citations while assuming familiarity with basic syntax.
                </p>
              </div>

              {/* Files with issues */}
              <div className="space-y-1.5">
                <p className="text-xs font-mono font-bold text-ink">Files with Issues</p>
                <div className="p-2 bg-surface border border-ink/30 rounded text-xs font-mono flex items-center justify-between">
                  <span className="truncate max-w-[190px]">registration.py</span>
                  <span className="px-1.5 py-0.2 bg-coral/20 text-coral font-bold rounded text-[10px]">
                    2 issues
                  </span>
                </div>
                <div className="p-2 bg-surface border border-ink/30 rounded text-xs font-mono flex items-center justify-between opacity-60">
                  <span className="truncate max-w-[190px]">cache.py</span>
                  <span className="text-[10px] text-mint font-bold">clean</span>
                </div>
              </div>

              {/* Multi-Agent Mini Timeline */}
              <div className="pt-2 border-t-2 border-ink/15 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono font-bold text-ink flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cobalt" />
                    <span>Agent Pipeline Mini-Trace</span>
                  </p>
                  <Link
                    to="/runs/run-9941"
                    className="text-[11px] font-mono text-cobalt font-bold hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Full trace</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-muted">
                    <span className="flex items-center gap-1 text-ink">
                      <CheckCircle2 className="w-3.5 h-3.5 text-mint" /> Static Analysis
                    </span>
                    <span>18ms (AST + Linters)</span>
                  </div>
                  <div className="flex items-center justify-between text-muted">
                    <span className="flex items-center gap-1 text-ink">
                      <CheckCircle2 className="w-3.5 h-3.5 text-mint" /> Retriever Agent
                    </span>
                    <span>140ms (ChromaDB)</span>
                  </div>
                  <div className="flex items-center justify-between text-muted">
                    <span className="flex items-center gap-1 text-ink">
                      <CheckCircle2 className="w-3.5 h-3.5 text-mint" /> Explainer Agent
                    </span>
                    <span>1.2s (Pedagogical synthesis)</span>
                  </div>
                  <div className="flex items-center justify-between text-muted">
                    <span className="flex items-center gap-1 text-ink">
                      <CheckCircle2 className="w-3.5 h-3.5 text-mint" /> Verifier Agent
                    </span>
                    <span className="text-ink font-bold">2/2 verified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

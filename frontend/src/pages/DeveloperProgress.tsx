import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Flame, 
  HelpCircle, 
  ExternalLink, 
  Sparkles, 
  Lock, 
  Award, 
  BookOpen
} from 'lucide-react';
import { ChartWithTable } from '../components/ChartWithTable';
import { EmptyState } from '../components/UIStates';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

export default function DeveloperProgressPage() {
  const { login = 'meera' } = useParams();
  const [showSkillPopover, setShowSkillPopover] = useState(false);
  const [viewerRole, setViewerRole] = useState<'developer' | 'lead'>('developer');
  const [isEmptyState, setIsEmptyState] = useState(false);

  // Line chart data: Mistakes per week by category
  const mistakesTrend = [
    { week: 'W1', sql: 4, mutableDefault: 2, unclosedFile: 1 },
    { week: 'W2', sql: 3, mutableDefault: 2, unclosedFile: 1 },
    { week: 'W3', sql: 2, mutableDefault: 1, unclosedFile: 0 },
    { week: 'W4', sql: 1, mutableDefault: 1, unclosedFile: 0 },
    { week: 'W5', sql: 0, mutableDefault: 0, unclosedFile: 0 },
    { week: 'W6', sql: 0, mutableDefault: 0, unclosedFile: 0 },
  ];

  const trendTableCols = [
    { key: 'week', header: 'Week' },
    { key: 'sql', header: 'SQL Injection' },
    { key: 'mutableDefault', header: 'Mutable Default' },
    { key: 'unclosedFile', header: 'Unclosed File' },
  ];

  // Most common categories horizontal bar
  const categoriesData = [
    { name: 'SQL Injection', count: 10, color: '#E5383B' },
    { name: 'Mutable Default Arg', count: 6, color: '#FFC53D' },
    { name: 'Unclosed File Handle', count: 2, color: '#5BC0EB' },
    { name: 'Bare Except Clause', count: 1, color: '#2DD4A0' },
  ];

  // Learning path recommendations
  const learningPath = [
    {
      id: 'lp-1',
      title: 'Parameterized SQL & ORM Abstractions',
      status: 'completed',
      summary: 'Learned query parameterization. Zero SQL injection occurrences across last 3 PRs!',
      linkedPr: 104,
    },
    {
      id: 'lp-2',
      title: 'Python Function Signatures & Mutable State',
      status: 'in_progress',
      summary: 'Avoid default mutable lists/dicts. Use `None` sentinel with local allocation.',
      linkedPr: 104,
    },
    {
      id: 'lp-3',
      title: 'Resource Lifecycle & Context Managers',
      status: 'upcoming',
      summary: 'Always employ `with open(...)` and database transaction managers.',
      linkedPr: 95,
    },
  ];

  // Milestones timeline
  const milestones = [
    {
      date: 'Oct 24, 2026',
      title: 'First Fully Clean PR 🎉',
      detail: 'PR #101 passed all multi-agent checks with 0 findings or regressions.',
    },
    {
      date: 'Oct 15, 2026',
      title: 'SQL Master Badge',
      detail: 'Applied suggested institutional fixes on 3 consecutive PRs.',
    },
    {
      date: 'Sep 28, 2026',
      title: 'First MentorLens Code Review',
      detail: 'Onboarded into campus-portal repository.',
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* State & Role Toggle Bar */}
      <div className="p-3 bg-surface-2 border-2 border-dashed border-ink/40 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <span className="text-muted">Test S09 View Modes:</span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewerRole(viewerRole === 'developer' ? 'lead' : 'developer')}
            className="px-2.5 py-1 bg-surface border-2 border-ink rounded font-bold shadow-brutal-sm hover:bg-sand"
          >
            Viewer: {viewerRole === 'developer' ? 'Developer View' : 'Team Lead View'}
          </button>
          <button
            onClick={() => setIsEmptyState(!isEmptyState)}
            className="px-2.5 py-1 bg-surface border-2 border-ink rounded font-bold shadow-brutal-sm hover:bg-sand"
          >
            {isEmptyState ? 'Show Populated Data' : 'Simulate Empty (<3 PRs)'}
          </button>
        </div>
      </div>

      {/* Header Profile Card */}
      <div className="bg-surface p-6 rounded-xl border-3 border-ink shadow-brutal space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-tangerine text-white text-xl font-bold flex items-center justify-center border-3 border-ink shadow-brutal-sm">
              MS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-2xl text-ink">Meera Sharma</h1>
                <span className="font-mono text-xs text-muted">@{login}</span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Junior Software Engineer • campus-portal team
              </p>
            </div>
          </div>

          {/* Skill Level Chip + Clean Streak */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Skill Level with Popover */}
            <div className="relative">
              <button
                onClick={() => setShowSkillPopover(!showSkillPopover)}
                className="btn-brutal inline-flex items-center gap-1.5 px-3 py-1.5 bg-cobalt text-white border-2 border-ink rounded-lg font-mono text-xs font-bold shadow-brutal-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Skill Level: Intermediate</span>
                <HelpCircle className="w-3.5 h-3.5 opacity-80" />
              </button>

              {/* Popover */}
              {showSkillPopover && (
                <div className="absolute right-0 top-10 z-20 w-72 p-3 bg-surface border-3 border-ink rounded-xl shadow-brutal text-xs font-sans space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between font-bold text-ink">
                    <span>How Skill Calibration Works</span>
                    <button
                      onClick={() => setShowSkillPopover(false)}
                      className="text-muted hover:text-ink"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-muted text-[11px] leading-relaxed">
                    MentorLens calibrates comment tone and depth based on review history:
                  </p>
                  <ul className="text-[11px] font-mono space-y-1 text-ink">
                    <li>• <strong>Beginner:</strong> Syntax explanation + step-by-step guidance.</li>
                    <li>• <strong>Intermediate:</strong> Architectural rationale + team citations.</li>
                    <li>• <strong>Advanced:</strong> Concise diffs + benchmark considerations.</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Clean Streak Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sun/20 border-2 border-ink rounded-lg font-mono text-xs font-bold text-ink shadow-brutal-sm">
              <Flame className="w-4 h-4 text-tangerine stroke-[2.5]" />
              <span>Weeks without repeated mistake: 3</span>
            </div>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="pt-2 border-t border-ink/15 flex items-center justify-between text-xs text-muted font-mono">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>Private: Visible only to you and campus-portal team leads. No public rankings.</span>
          </span>
          {viewerRole === 'lead' && (
            <span className="text-cobalt font-bold">Viewing in Team Lead Mentorship Mode</span>
          )}
        </div>
      </div>

      {isEmptyState ? (
        <EmptyState
          icon={Award}
          title="Not enough data yet"
          description="Complete at least 3 reviewed pull requests on campus-portal to unlock your personalized learning curve and milestone achievements."
          actionLabel="View PR Queue →"
          onAction={() => {}}
        />
      ) : (
        <>
          {/* Row: 2 Charts Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Chart (7 cols): Mistakes per week by category */}
            <div className="lg:col-span-7">
              <ChartWithTable
                title="Mistakes Per Week by Category"
                description="Drop in errors as learning curve takes effect. Separate line styles per category."
                columns={trendTableCols}
                tableData={mistakesTrend}
                chart={
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={mistakesTrend} margin={{ top: 15, right: 20, left: -20, bottom: 0 }}>
                      <XAxis dataKey="week" stroke="#111111" tick={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                      <YAxis stroke="#111111" tick={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#F4EFE6',
                          border: '2px solid #111111',
                          borderRadius: '8px',
                          boxShadow: '4px 4px 0 #111111',
                          fontFamily: 'JetBrains Mono',
                          fontSize: '11px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="sql"
                        name="SQL Injection"
                        stroke="#E5383B"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#E5383B', stroke: '#111' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="mutableDefault"
                        name="Mutable Default"
                        stroke="#FFC53D"
                        strokeWidth={3}
                        strokeDasharray="4 4"
                        dot={{ r: 4, fill: '#FFC53D', stroke: '#111' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="unclosedFile"
                        name="Unclosed File"
                        stroke="#5BC0EB"
                        strokeWidth={2}
                        strokeDasharray="2 2"
                        dot={{ r: 3, fill: '#5BC0EB', stroke: '#111' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                }
              />
            </div>

            {/* Right Chart (5 cols): Most Common Categories Horizontal Bar */}
            <div className="lg:col-span-5 bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-extrabold text-base text-ink">Most Common Categories</h3>
                <span className="text-xs font-mono text-muted">All-time count</span>
              </div>

              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={categoriesData}
                    margin={{ top: 10, right: 20, left: 40, bottom: 0 }}
                  >
                    <XAxis type="number" stroke="#111111" tick={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#111111"
                      tick={{ fontFamily: 'JetBrains Mono', fontSize: 10 }}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#F4EFE6',
                        border: '2px solid #111111',
                        borderRadius: '8px',
                        fontFamily: 'JetBrains Mono',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {categoriesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#111111" strokeWidth={1.5} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row: Learning Path & Milestones */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Learning Path (7 cols) */}
            <div className="lg:col-span-7 bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-cobalt" />
                  <h3 className="font-display font-extrabold text-lg text-ink">Recommended Learning Path</h3>
                </div>
                <span className="text-xs font-mono text-mint font-bold">1 of 3 Completed</span>
              </div>

              <div className="space-y-3">
                {learningPath.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-surface-2 border-2 border-ink rounded-lg space-y-2 shadow-brutal-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.status === 'completed' ? (
                          <span className="w-5 h-5 rounded-full bg-mint text-ink flex items-center justify-center border border-ink text-[10px] font-bold">
                            ✓
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-surface text-ink flex items-center justify-center border border-ink text-[10px] font-mono font-bold">
                            •
                          </span>
                        )}
                        <h4 className="font-mono text-xs font-bold text-ink">{item.title}</h4>
                      </div>

                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                          item.status === 'completed'
                            ? 'bg-mint/20 border-mint text-ink font-bold'
                            : item.status === 'in_progress'
                            ? 'bg-sun/20 border-sun text-ink font-bold'
                            : 'bg-surface border-ink/30 text-muted'
                        }`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-muted leading-relaxed pl-7">{item.summary}</p>

                    <div className="pl-7 pt-1 flex items-center justify-between text-xs font-mono">
                      <Link
                        to={`/prs/pr-${item.linkedPr}`}
                        className="text-cobalt hover:underline font-bold inline-flex items-center gap-1"
                      >
                        <span>Citing PR #{item.linkedPr}</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Milestones Timeline (5 cols) */}
            <div className="lg:col-span-5 bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-tangerine" />
                <h3 className="font-display font-extrabold text-lg text-ink">Milestones</h3>
              </div>

              <div className="space-y-4 pl-2 border-l-2 border-ink font-mono text-xs">
                {milestones.map((m, idx) => (
                  <div key={idx} className="relative pl-4">
                    <span className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-mint border-2 border-ink" />
                    <span className="text-[10px] text-muted">{m.date}</span>
                    <h4 className="font-bold text-ink mt-0.5">{m.title}</h4>
                    <p className="text-muted text-[11px] font-sans mt-0.5">{m.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

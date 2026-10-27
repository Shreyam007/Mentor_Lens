import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GitPullRequest, 
  Clock, 
  Calendar, 
  ChevronDown, 
  ArrowUpRight, 
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  PlusCircle,
  Copy,
  Check
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { ChartWithTable } from '../components/ChartWithTable';
import { SeverityBadge } from '../components/Badges';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState('Last 30 days');
  const [activeRepo, setActiveRepo] = useState('campus-portal');
  const [isEmptyRepo, setIsEmptyRepo] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Sample data for Recharts
  const weeklyData = [
    { week: 'W1', overallMistakes: 18, repeatedMistakes: 12 },
    { week: 'W2', overallMistakes: 16, repeatedMistakes: 10 },
    { week: 'W3', overallMistakes: 13, repeatedMistakes: 7 },
    { week: 'W4', overallMistakes: 11, repeatedMistakes: 5 },
    { week: 'W5', overallMistakes: 9, repeatedMistakes: 4 },
    { week: 'W6', overallMistakes: 6, repeatedMistakes: 2 },
  ];

  const tableColumns = [
    { key: 'week', header: 'Week' },
    { key: 'overallMistakes', header: 'Total Mistakes Flagged' },
    { key: 'repeatedMistakes', header: 'Repeated Patterns' },
  ];

  const topRecurringMistakes = [
    { category: 'SQL Injection', count: 8, trend: '-42%', direction: 'down' },
    { category: 'Mutable Default Argument', count: 6, trend: '-25%', direction: 'down' },
    { category: 'Unclosed File Handle', count: 4, trend: '-50%', direction: 'down' },
    { category: 'Hardcoded Secret', count: 2, trend: '-60%', direction: 'down' },
  ];

  const recentReviews = [
    {
      id: 'pr-104',
      number: 104,
      title: 'feat: add student batch registration controller',
      author: 'Meera Sharma',
      avatar: 'MS',
      critical: 1,
      warning: 2,
      suggestion: 1,
      verifiedCitations: 2,
      timeAgo: '15 min ago',
      status: 'Reviewed',
    },
    {
      id: 'pr-103',
      number: 103,
      title: 'fix: handle postgres cursor leak in exam export',
      author: 'Aarav Patel',
      avatar: 'AP',
      critical: 0,
      warning: 1,
      suggestion: 0,
      verifiedCitations: 1,
      timeAgo: '2 hours ago',
      status: 'Reviewed',
    },
    {
      id: 'pr-102',
      number: 102,
      title: 'refactor: session authentication middleware',
      author: 'Rohan Gupta',
      avatar: 'RG',
      critical: 0,
      warning: 0,
      suggestion: 2,
      verifiedCitations: 0,
      timeAgo: 'Yesterday',
      status: 'Reviewed',
    },
    {
      id: 'pr-101',
      number: 101,
      title: 'chore: bump cryptography library dependency',
      author: 'Ishita Roy',
      avatar: 'IR',
      critical: 0,
      warning: 0,
      suggestion: 0,
      verifiedCitations: 0,
      timeAgo: '2 days ago',
      status: 'Clean PR',
    },
  ];

  const testPrSnippet = `# To test MentorLens review on a new PR:
git checkout -b test-mentorlens
echo "def fetch_student(db, id): return db.query(f'SELECT * FROM students WHERE id={id}')" >> test.py
git commit -am "test: introduce SQL query without params"
git push origin test-mentorlens
# Open PR on GitHub to watch MentorLens comment with past commit citations!`;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(testPrSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-mint" />
            <h1 className="font-display font-extrabold text-2xl text-ink">Team Dashboard</h1>
          </div>
          <p className="text-xs text-muted">
            Continuous institutional code memory for engineering quality and mentorship.
          </p>
        </div>

        {/* Controls: Repo Switcher & Date Range & Empty State Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Empty State Simulator */}
          <button
            onClick={() => setIsEmptyRepo(!isEmptyRepo)}
            className="px-2.5 py-1 text-xs font-mono bg-surface-2 border-2 border-ink rounded-lg shadow-brutal-sm hover:bg-sand"
          >
            {isEmptyRepo ? 'View Populated Repo' : 'Simulate Empty Repo'}
          </button>

          {/* Repo Switcher */}
          <div className="relative">
            <select
              value={activeRepo}
              onChange={(e) => setActiveRepo(e.target.value)}
              className="px-3 py-1.5 bg-surface border-2 border-ink rounded-lg shadow-brutal-sm font-mono text-xs font-bold text-ink pr-8 appearance-none cursor-pointer"
            >
              <option value="campus-portal">campus-portal</option>
              <option value="course-reg-api">course-reg-api</option>
              <option value="mentorlens-demo">mentorlens-demo</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Date Range Selector */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-1.5 bg-surface border-2 border-ink rounded-lg shadow-brutal-sm font-mono text-xs font-medium text-ink pr-8 appearance-none cursor-pointer"
            >
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </select>
            <Calendar className="w-3.5 h-3.5 text-muted absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Brand New Repo Empty State */}
      {isEmptyRepo ? (
        <div className="bg-surface p-8 rounded-xl border-3 border-ink shadow-brutal space-y-6 max-w-3xl mx-auto my-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-mint/20 border-2 border-ink flex items-center justify-center shrink-0">
              <PlusCircle className="w-6 h-6 text-mint" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-xl text-ink">Welcome to {activeRepo}!</h2>
              <p className="text-sm text-muted mt-1 leading-relaxed">
                Repository history is indexed, but no pull requests have been reviewed yet.
                Open your first pull request to see MentorLens analyse code and cite your team's past fixes in action.
              </p>
            </div>
          </div>

          <div className="bg-[#111111] text-paper p-4 rounded-lg border-2 border-ink font-mono text-xs relative">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-paper/20 text-muted">
              <span>Quick Start Test Snippet</span>
              <button
                onClick={handleCopySnippet}
                className="flex items-center gap-1 text-mint hover:underline font-bold"
              >
                {copiedSnippet ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSnippet ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="whitespace-pre-wrap">{testPrSnippet}</pre>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setIsEmptyRepo(false)}
              className="btn-brutal px-4 py-2 bg-surface text-ink border-2 border-ink rounded-lg text-xs font-bold"
            >
              Cancel
            </button>
            <button
              onClick={() => navigate('/prs')}
              className="btn-brutal px-5 py-2 bg-cobalt text-white border-2 border-ink rounded-lg text-xs font-bold shadow-brutal"
            >
              View PR Queue →
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Row 1: 4 Top Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="PRs Reviewed (30d)"
              value="42"
              delta="+18% vs prev"
              subtext="100% evaluated by multi-agent pipeline"
            />
            <StatCard
              label="Fix-Acceptance Rate"
              value="87.5%"
              delta="+12% growth"
              subtext="Junior devs applied suggested fixes"
            />
            <StatCard
              label="Median Time-to-Feedback"
              value="18.4s"
              delta="-4.2s faster"
              subtext="Compared to 4.2h human review delay"
            />
            <StatCard
              label="Repeat-Mistake Rate"
              value="14.2%"
              delta="-38% reduction"
              isGoodTrend={true}
              subtext="Repeated bugs dropped across team"
            />
          </div>

          {/* Row 2: Large Line Chart & Recurring Mistakes Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* 2 Cols: Line Chart with Table Toggle */}
            <div className="lg:col-span-2">
              <ChartWithTable
                title="Repeated Mistakes Per Week"
                description="Drop in recurring mistake patterns over time. Solid: Total findings, Dashed: Repeated patterns."
                columns={tableColumns}
                tableData={weeklyData}
                chart={
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={weeklyData} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                      <XAxis 
                        dataKey="week" 
                        stroke="#111111" 
                        tick={{ fontFamily: 'JetBrains Mono', fontSize: 12 }} 
                      />
                      <YAxis 
                        stroke="#111111" 
                        tick={{ fontFamily: 'JetBrains Mono', fontSize: 12 }} 
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#F4EFE6',
                          border: '2px solid #111111',
                          borderRadius: '8px',
                          boxShadow: '4px 4px 0 #111111',
                          fontFamily: 'JetBrains Mono',
                          fontSize: '12px',
                        }}
                      />
                      {/* Overall Mistakes - Solid Line */}
                      <Line
                        type="monotone"
                        dataKey="overallMistakes"
                        name="Total Findings"
                        stroke="#2F4BFF"
                        strokeWidth={3}
                        dot={{ r: 4, stroke: '#111111', strokeWidth: 2, fill: '#2F4BFF' }}
                      />
                      {/* Repeated Mistakes - Dashed Line */}
                      <Line
                        type="monotone"
                        dataKey="repeatedMistakes"
                        name="Repeated Patterns"
                        stroke="#FF6B2C"
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        dot={{ r: 4, stroke: '#111111', strokeWidth: 2, fill: '#FF6B2C' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                }
              />
            </div>

            {/* 1 Col: Top Recurring Mistakes */}
            <div className="bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-extrabold text-lg text-ink">Top Recurring Mistakes</h3>
                <span className="text-xs font-mono text-muted">30d count</span>
              </div>

              <div className="space-y-3 font-mono">
                {topRecurringMistakes.map((item, idx) => (
                  <div
                    key={item.category}
                    className="p-3 bg-surface-2 border-2 border-ink rounded-lg flex items-center justify-between shadow-brutal-sm hover:translate-y-[-1px] transition-transform"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded bg-surface border border-ink text-[11px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-ink truncate max-w-[140px]">
                          {item.category}
                        </p>
                        <p className="text-[10px] text-muted">{item.count} occurrences</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-mint text-xs font-bold">
                      {item.direction === 'down' ? (
                        <TrendingDown className="w-3.5 h-3.5 text-mint" />
                      ) : (
                        <TrendingUp className="w-3.5 h-3.5 text-coral" />
                      )}
                      <span>{item.trend}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-center">
                <button
                  onClick={() => navigate('/analytics')}
                  className="text-xs font-bold text-cobalt hover:underline inline-flex items-center gap-1"
                >
                  <span>Explore full heatmap & analytics</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Recent Reviews Table */}
          <div className="bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-extrabold text-lg text-ink">Recent Reviews</h3>
                <p className="text-xs text-muted">Latest pull requests reviewed by MentorLens</p>
              </div>

              <button
                onClick={() => navigate('/prs')}
                className="btn-brutal px-3.5 py-1.5 bg-surface text-ink border-2 border-ink rounded-lg text-xs font-bold shadow-brutal-sm"
              >
                View All PRs →
              </button>
            </div>

            <div className="overflow-x-auto border-2 border-ink rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-2 border-b-2 border-ink text-ink font-mono uppercase">
                  <tr>
                    <th className="p-3">Pull Request</th>
                    <th className="p-3">Author</th>
                    <th className="p-3">Findings</th>
                    <th className="p-3">Verification</th>
                    <th className="p-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/15 font-mono">
                  {recentReviews.map((pr) => (
                    <tr
                      key={pr.id}
                      onClick={() => navigate(`/prs/${pr.id}`)}
                      className="hover:bg-sand/30 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <GitPullRequest className="w-4 h-4 text-cobalt shrink-0" />
                          <span className="font-bold text-ink">#{pr.number}</span>
                          <span className="font-sans text-xs font-medium text-ink hover:underline">
                            {pr.title}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded bg-tangerine text-white text-[10px] font-bold flex items-center justify-center border border-ink">
                            {pr.avatar}
                          </span>
                          <span className="font-sans text-xs">{pr.author}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {pr.critical > 0 && <SeverityBadge severity="critical" />}
                          {pr.warning > 0 && <SeverityBadge severity="warning" />}
                          {pr.suggestion > 0 && <SeverityBadge severity="suggestion" />}
                          {pr.critical === 0 && pr.warning === 0 && pr.suggestion === 0 && (
                            <span className="text-[10px] text-mint font-bold px-2 py-0.5 bg-mint/20 border border-mint rounded">
                              Clean
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {pr.verifiedCitations > 0 ? (
                          <div className="inline-flex items-center gap-1 text-[11px] text-mint font-bold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{pr.verifiedCitations} citation verified</span>
                          </div>
                        ) : (
                          <span className="text-muted text-[11px]">General guidance</span>
                        )}
                      </td>
                      <td className="p-3 text-right text-muted flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{pr.timeAgo}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

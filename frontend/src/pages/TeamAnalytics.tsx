import { useState } from 'react';
import { 
  BarChart3, 
  Download, 
  EyeOff, 
  Eye, 
  ChevronDown, 
  Calendar,
  GraduationCap
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Legend
} from 'recharts';
import { EmptyState } from '../components/UIStates';

export default function TeamAnalyticsPage() {
  const [isAnonymized, setIsAnonymized] = useState(false);
  const [isInsufficientData, setIsInsufficientData] = useState(false);
  const [dateRange, setDateRange] = useState('Last 30 days');
  const [activeRepo, setActiveRepo] = useState('campus-portal');

  // Heatmap: categories by week (numbers in cells + pattern/legend)
  const heatmapWeeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const heatmapCategories = [
    { name: 'SQL Injection', counts: [8, 5, 2, 1] },
    { name: 'Mutable Default Arg', counts: [6, 4, 3, 1] },
    { name: 'Unclosed File Handle', counts: [4, 2, 1, 0] },
    { name: 'Hardcoded Secret', counts: [3, 1, 0, 0] },
    { name: 'Bare Except Clause', counts: [5, 3, 2, 1] },
  ];

  // Developer stacked bar data
  const devData = [
    {
      dev: isAnonymized ? 'Dev #1 (Junior)' : 'Meera Sharma',
      sql: 4,
      mutable: 3,
      file: 1,
      secret: 0,
    },
    {
      dev: isAnonymized ? 'Dev #2 (Junior)' : 'Aarav Patel',
      sql: 2,
      mutable: 1,
      file: 2,
      secret: 1,
    },
    {
      dev: isAnonymized ? 'Dev #3 (Mid-level)' : 'Rohan Gupta',
      sql: 1,
      mutable: 2,
      file: 0,
      secret: 0,
    },
    {
      dev: isAnonymized ? 'Dev #4 (Senior)' : 'Ishita Roy',
      sql: 0,
      mutable: 0,
      file: 1,
      secret: 0,
    },
  ];

  // Time to feedback data: MentorLens vs Human
  const timeToFeedbackData = [
    { metric: 'Initial Feedback', mentorLensSec: 18, humanSec: 14400, labelMentor: '18s', labelHuman: '4.0h' },
    { metric: 'Re-review Feedback', mentorLensSec: 12, humanSec: 7200, labelMentor: '12s', labelHuman: '2.0h' },
  ];

  // Training topics
  const trainingTopics = [
    {
      title: 'Workshop: Safe SQL & Parameterized Database Queries',
      urgency: 'Recommended',
      reason: '16 total occurrences across team in past 30 days. Highest risk category.',
    },
    {
      title: 'Python Gotchas: Mutable Defaults & Object References',
      urgency: 'Medium',
      reason: '14 occurrences affecting 3 developers on PR batching modules.',
    },
    {
      title: 'Context Managers and Resource Clean-up',
      urgency: 'Low',
      reason: '7 occurrences, mostly resolved by linters and AST rules.',
    },
  ];

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,Category,W1,W2,W3,W4\n' +
      heatmapCategories.map((c) => `${c.name},${c.counts.join(',')}`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mentorlens-analytics-${activeRepo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Controls Header */}
      <div className="bg-surface p-5 sm:p-6 rounded-xl border-3 border-ink shadow-brutal flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-cobalt" />
            <h1 className="font-display font-extrabold text-2xl text-ink">Team Analytics</h1>
          </div>
          <p className="text-xs text-muted">
            Institutional code quality insights and mentorship metrics for engineering leads.
          </p>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Insufficient Data Simulator */}
          <button
            onClick={() => setIsInsufficientData(!isInsufficientData)}
            className="px-2.5 py-1 text-xs font-mono bg-surface-2 border-2 border-ink rounded-lg shadow-brutal-sm hover:bg-sand"
          >
            {isInsufficientData ? 'Show Full Analytics' : 'Simulate <4 Weeks Data'}
          </button>

          {/* Anonymize Mode Toggle */}
          <button
            onClick={() => setIsAnonymized(!isAnonymized)}
            className={`btn-brutal inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-ink font-mono text-xs font-bold shadow-brutal-sm ${
              isAnonymized ? 'bg-mint text-ink' : 'bg-surface text-ink hover:bg-sand'
            }`}
          >
            {isAnonymized ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{isAnonymized ? 'Names Anonymized' : 'Anonymize Names'}</span>
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
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Date range */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-1.5 bg-surface border-2 border-ink rounded-lg shadow-brutal-sm font-mono text-xs font-medium text-ink pr-8 appearance-none cursor-pointer"
            >
              <option>Last 30 days</option>
              <option>Last 60 days</option>
              <option>Last 90 days</option>
            </select>
            <Calendar className="w-3.5 h-3.5 text-muted absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="btn-brutal inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-cobalt text-white border-2 border-ink rounded-lg text-xs font-bold shadow-brutal-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {isInsufficientData ? (
        <EmptyState
          icon={BarChart3}
          title="Need at least 4 weeks of data for trends"
          description="Repository has been active for only 12 days. Historical trend heatmaps and time-to-feedback distributions will unlock as more reviews conclude."
          actionLabel="Switch to Demo Repo"
          onAction={() => setActiveRepo('mentorlens-demo')}
        />
      ) : (
        <>
          {/* Section 1: Mistake Category Heatmap */}
          <div className="bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-extrabold text-lg text-ink">
                  Mistake Categories by Week (Heatmap)
                </h3>
                <p className="text-xs text-muted">
                  Frequency of triggered rules over time. Each cell shows exact count and intensity shading.
                </p>
              </div>

              {/* Accessible Legend */}
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-muted">Legend:</span>
                <span className="px-2 py-0.5 bg-sand/30 border border-ink/20 rounded">0 (Clean)</span>
                <span className="px-2 py-0.5 bg-sun/30 border border-ink/20 rounded">1-2 (Low)</span>
                <span className="px-2 py-0.5 bg-tangerine/30 border border-ink/20 rounded font-bold">3-4 (Med)</span>
                <span className="px-2 py-0.5 bg-coral/40 border border-ink/20 rounded text-coral font-bold">5+ (High)</span>
              </div>
            </div>

            <div className="overflow-x-auto border-2 border-ink rounded-lg">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className="bg-surface-2 border-b-2 border-ink text-ink uppercase">
                  <tr>
                    <th className="p-3 w-1/3">Mistake Category</th>
                    {heatmapWeeks.map((w) => (
                      <th key={w} className="p-3 text-center">{w}</th>
                    ))}
                    <th className="p-3 text-right">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/15">
                  {heatmapCategories.map((cat) => {
                    const diff = cat.counts[3] - cat.counts[0];
                    return (
                      <tr key={cat.name} className="hover:bg-sand/20">
                        <td className="p-3 font-bold text-ink">{cat.name}</td>
                        {cat.counts.map((count, i) => {
                          const bg =
                            count >= 5
                              ? 'bg-coral/30 text-coral font-bold'
                              : count >= 3
                              ? 'bg-tangerine/25 text-ink font-bold'
                              : count >= 1
                              ? 'bg-sun/20 text-ink'
                              : 'bg-sand/10 text-muted';
                          return (
                            <td key={i} className={`p-3 text-center border-l border-ink/10 ${bg}`}>
                              {count}
                            </td>
                          );
                        })}
                        <td className="p-3 text-right font-bold text-mint">
                          {diff < 0 ? `${diff} (improving)` : 'steady'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2 & 3: Stacked Bar per Dev + Time-to-Feedback Bar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Stacked Bar: Mistakes by Developer (7 cols) */}
            <div className="lg:col-span-7 bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-extrabold text-base text-ink">
                    Mistakes by Category per Developer
                  </h3>
                  <p className="text-xs text-muted">
                    {isAnonymized ? 'Anonymized identity mode active' : 'Click "Anonymize Names" to hide handles'}
                  </p>
                </div>
              </div>

              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={devData} margin={{ top: 15, right: 20, left: 0, bottom: 0 }}>
                    <XAxis dataKey="dev" stroke="#111111" tick={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                    <YAxis stroke="#111111" tick={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#F4EFE6',
                        border: '2px solid #111111',
                        borderRadius: '8px',
                        fontFamily: 'JetBrains Mono',
                        fontSize: '11px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: '11px' }} />
                    <Bar dataKey="sql" name="SQL Injection" stackId="a" fill="#E5383B" stroke="#111" />
                    <Bar dataKey="mutable" name="Mutable Default" stackId="a" fill="#FFC53D" stroke="#111" />
                    <Bar dataKey="file" name="Unclosed File" stackId="a" fill="#5BC0EB" stroke="#111" />
                    <Bar dataKey="secret" name="Hardcoded Secret" stackId="a" fill="#FF6B2C" stroke="#111" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Senior Agreement & Time to Feedback (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Senior Agreement Gauge Card */}
              <div className="bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase text-muted">
                    Agreement with Senior Reviews
                  </span>
                  <span className="text-[11px] font-mono text-muted">Sample: n=128 PRs</span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="font-display font-extrabold text-4xl text-ink">91.4%</span>
                  <span className="text-xs font-mono font-bold text-mint">High Concordance</span>
                </div>

                {/* Progress Gauge Bar */}
                <div className="w-full h-3 bg-surface-2 border-2 border-ink rounded-full overflow-hidden p-0.5">
                  <div className="h-full bg-mint rounded-full" style={{ width: '91.4%' }} />
                </div>
                <p className="text-[11px] text-muted leading-tight">
                  Independent senior reviewer verdict matched MentorLens critical/warning gate decisions on 117 of 128 tested PRs.
                </p>
              </div>

              {/* Time to Feedback Comparison */}
              <div className="bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-3">
                <h3 className="font-display font-extrabold text-base text-ink">
                  Time to Feedback: MentorLens vs Human
                </h3>

                <div className="space-y-3 font-mono text-xs">
                  {timeToFeedbackData.map((item) => (
                    <div key={item.metric} className="p-3 bg-surface-2 border-2 border-ink rounded-lg space-y-1.5">
                      <span className="font-bold text-ink block">{item.metric}</span>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-cobalt font-bold">MentorLens: {item.labelMentor}</span>
                        <span className="text-muted">Senior Human: {item.labelHuman}</span>
                      </div>
                      <div className="w-full h-2 bg-sand/40 border border-ink rounded-full overflow-hidden flex">
                        <div className="bg-cobalt w-[3%]" />
                        <div className="bg-muted/40 flex-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Suggested Team Training Topics */}
          <div className="bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-cobalt" />
              <h3 className="font-display font-extrabold text-lg text-ink">
                Suggested Team Training Topics
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
              {trainingTopics.map((topic, i) => (
                <div
                  key={i}
                  className="p-4 bg-surface-2 border-2 border-ink rounded-xl shadow-brutal-sm space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border inline-block mb-1.5 ${
                        topic.urgency === 'Recommended'
                          ? 'bg-coral/20 border-coral text-coral'
                          : topic.urgency === 'Medium'
                          ? 'bg-sun/20 border-sun text-ink'
                          : 'bg-mint/20 border-mint text-ink'
                      }`}
                    >
                      {topic.urgency} Priority
                    </span>
                    <h4 className="font-sans font-bold text-sm text-ink">{topic.title}</h4>
                    <p className="text-muted text-[11px] font-sans mt-1 leading-relaxed">
                      {topic.reason}
                    </p>
                  </div>

                  <button
                    onClick={() => alert(`Scheduling mentorship session: ${topic.title}`)}
                    className="btn-brutal mt-3 py-1.5 px-3 bg-surface border-2 border-ink rounded font-bold text-[11px] hover:bg-sand"
                  >
                    Schedule Mentorship Session →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sliders, 
  ShieldAlert, 
  Save, 
  RotateCcw, 
  AlertTriangle, 
  Sparkles, 
  X, 
  Plus, 
  Check, 
  Layers, 
  Lock, 
  Key, 
  Bell, 
  Users, 
  FolderGit2
} from 'lucide-react';
import { ConfirmDialog } from '../components/UIStates';

export default function SettingsRulesPage() {
  // Settings form state
  const [reviewDrafts, setReviewDrafts] = useState(false);
  const [skipBots, setSkipBots] = useState(true);
  const [ignorePatterns, setIgnorePatterns] = useState<string[]>([
    '*.lock',
    'dist/**',
    'generated/**',
    '**/vendor/**',
    '*.min.js',
  ]);
  const [newPattern, setNewPattern] = useState('');
  const [languages, setLanguages] = useState<string[]>(['Python', 'JavaScript/TypeScript']);
  const [reviewDepth, setReviewDepth] = useState<'auto' | 'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [minSeverity, setMinSeverity] = useState<'info' | 'suggestion' | 'warning' | 'critical'>('suggestion');
  const [maxComments, setMaxComments] = useState(8);
  const [gateMode, setGateMode] = useState<'off' | 'advisory' | 'blocking'>('blocking');

  // Dirty state tracking
  const [isDirty, setIsDirty] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const markDirty = () => {
    setIsDirty(true);
    setIsSaved(false);
  };

  const handleAddPattern = () => {
    if (newPattern.trim() && !ignorePatterns.includes(newPattern.trim())) {
      setIgnorePatterns([...ignorePatterns, newPattern.trim()]);
      setNewPattern('');
      markDirty();
    }
  };

  const handleRemovePattern = (pattern: string) => {
    setIgnorePatterns(ignorePatterns.filter((p) => p !== pattern));
    markDirty();
  };

  const toggleLanguage = (lang: string) => {
    if (languages.includes(lang)) {
      setLanguages(languages.filter((l) => l !== lang));
    } else {
      setLanguages([...languages, lang]);
    }
    markDirty();
  };

  const handleSave = () => {
    setIsDirty(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleReset = () => {
    setReviewDrafts(false);
    setSkipBots(true);
    setIgnorePatterns(['*.lock', 'dist/**', 'generated/**', '**/vendor/**']);
    setLanguages(['Python', 'JavaScript/TypeScript']);
    setReviewDepth('intermediate');
    setMinSeverity('suggestion');
    setMaxComments(8);
    setGateMode('blocking');
    setIsDirty(false);
    setShowResetConfirm(false);
  };

  // Preview text based on review depth
  const depthPreviews = {
    auto: 'Dynamically adapts based on whether the PR author is a junior developer, intern, or senior maintainer.',
    beginner:
      'MentorLens will explain the foundational syntax concept first, break down the risk step-by-step, and provide complete drop-in copyable code.',
    intermediate:
      'MentorLens assumes familiarity with language syntax, focusing directly on architectural risks, race conditions, and citations to your team\'s past bug fixes.',
    advanced:
      'Concise diff-first comments focusing on micro-benchmarks, concurrency, and security invariants without boilerplate syntax explanations.',
  };

  const subNav = [
    { label: 'Repositories', path: '/settings/repos', icon: FolderGit2 },
    { label: 'Review Rules & Gate', path: '/settings/rules', icon: Sliders, active: true },
    { label: 'Integrations & Health', path: '/settings/integrations', icon: Key },
    { label: 'Notifications', path: '/settings/notifications', icon: Bell },
    { label: 'LLM & Limits', path: '/settings/llm', icon: Layers },
    { label: 'Data & Privacy', path: '/settings/privacy', icon: Lock },
    { label: 'Team & Access', path: '/settings/team', icon: Users },
  ];

  return (
    <div className="space-y-6 pb-24">
      {/* Top Header */}
      <div className="bg-surface p-5 sm:p-6 rounded-xl border-3 border-ink shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-ink">Repository Settings</h1>
          <p className="text-xs text-muted font-mono">
            Configuring review rules and PR gate enforcement for <strong className="text-ink">campus-portal</strong>
          </p>
        </div>

        <button
          onClick={() => setShowResetConfirm(true)}
          className="btn-brutal inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface text-ink border-2 border-ink rounded-lg font-mono text-xs font-bold shadow-brutal-sm hover:bg-sand"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Defaults</span>
        </button>
      </div>

      {/* 2-Column: Left Sub-navigation + Right Settings Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sub-nav (3 cols) */}
        <div className="lg:col-span-3 bg-surface p-3 rounded-xl border-3 border-ink shadow-brutal space-y-1">
          {subNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-colors ${
                  item.active
                    ? 'bg-cobalt text-white border-2 border-ink shadow-brutal-sm font-bold'
                    : 'text-ink hover:bg-surface-2'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Settings Body (9 cols) */}
        <div className="lg:col-span-9 space-y-6">
          {/* Section 1: PR Intake Filters */}
          <div className="bg-surface p-6 rounded-xl border-3 border-ink shadow-brutal space-y-4">
            <h2 className="font-display font-extrabold text-lg text-ink">PR Intake Filters</h2>

            <div className="space-y-3 font-mono text-xs">
              {/* Draft PRs Toggle */}
              <label className="flex items-center justify-between p-3 bg-surface-2 border-2 border-ink rounded-lg cursor-pointer hover:bg-sand/30">
                <div>
                  <span className="font-bold text-ink block">Review Draft Pull Requests</span>
                  <span className="text-[11px] text-muted">
                    When disabled, PRs marked as draft will be ignored until marked ready for review.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={reviewDrafts}
                  onChange={(e) => {
                    setReviewDrafts(e.target.checked);
                    markDirty();
                  }}
                  className="w-5 h-5 rounded border-2 border-ink text-cobalt focus:ring-tangerine cursor-pointer"
                />
              </label>

              {/* Bot PRs Toggle */}
              <label className="flex items-center justify-between p-3 bg-surface-2 border-2 border-ink rounded-lg cursor-pointer hover:bg-sand/30">
                <div>
                  <span className="font-bold text-ink block">Skip Bot PRs</span>
                  <span className="text-[11px] text-muted">
                    Automatically skip PRs opened by Dependabot, Renovate, or other automated bots.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={skipBots}
                  onChange={(e) => {
                    setSkipBots(e.target.checked);
                    markDirty();
                  }}
                  className="w-5 h-5 rounded border-2 border-ink text-cobalt focus:ring-tangerine cursor-pointer"
                />
              </label>
            </div>

            {/* File Ignore Patterns */}
            <div className="space-y-2 pt-2">
              <label className="font-mono text-xs font-bold text-ink block">
                File Ignore Patterns (Glob Expressions)
              </label>
              <p className="text-xs text-muted">
                Files matching these glob patterns will be skipped from static analysis and AI review.
              </p>

              {/* Tag Cloud */}
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-surface-2 border-2 border-ink rounded-lg min-h-[44px]">
                {ignorePatterns.map((pat) => (
                  <span
                    key={pat}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-ink/40 rounded font-mono text-xs text-ink shadow-brutal-sm"
                  >
                    <span>{pat}</span>
                    <button
                      onClick={() => handleRemovePattern(pat)}
                      className="text-muted hover:text-coral"
                      aria-label={`Remove ${pat}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add Tag Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPattern()}
                  placeholder="e.g. *.lock, dist/**, generated/**"
                  className="flex-1 px-3 py-1.5 bg-surface-2 border-2 border-ink rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-tangerine"
                />
                <button
                  onClick={handleAddPattern}
                  className="btn-brutal inline-flex items-center gap-1 px-3 py-1.5 bg-surface text-ink border-2 border-ink rounded-lg font-mono text-xs font-bold shadow-brutal-sm hover:bg-sand"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Pattern</span>
                </button>
              </div>
            </div>

            {/* Enabled Languages */}
            <div className="space-y-2 pt-2">
              <label className="font-mono text-xs font-bold text-ink block">
                Languages Enabled
              </label>
              <div className="flex flex-wrap gap-3 font-mono text-xs">
                {['Python', 'JavaScript/TypeScript', 'Go', 'SQL'].map((lang) => {
                  const checked = languages.includes(lang);
                  return (
                    <label
                      key={lang}
                      className={`px-3 py-1.5 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-2 ${
                        checked
                          ? 'bg-cobalt/10 border-cobalt font-bold text-cobalt'
                          : 'bg-surface-2 border-ink/20 text-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLanguage(lang)}
                        className="rounded border-ink text-cobalt"
                      />
                      <span>{lang}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Pedagogical Depth & Limits */}
          <div className="bg-surface p-6 rounded-xl border-3 border-ink shadow-brutal space-y-4">
            <h2 className="font-display font-extrabold text-lg text-ink">Review Depth & Budget Limits</h2>

            {/* Depth Selector with Preview */}
            <div className="space-y-2">
              <label className="font-mono text-xs font-bold text-ink block">
                Review Depth Calibration
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                {(['auto', 'beginner', 'intermediate', 'advanced'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setReviewDepth(mode);
                      markDirty();
                    }}
                    className={`p-2.5 rounded-lg border-2 font-bold capitalize transition-all ${
                      reviewDepth === mode
                        ? 'bg-cobalt text-white border-ink shadow-brutal-sm'
                        : 'bg-surface-2 border-ink/30 text-ink hover:bg-sand'
                    }`}
                  >
                    {mode === 'auto' ? 'Auto-calibrate' : mode}
                  </button>
                ))}
              </div>

              {/* Dynamic Preview Box */}
              <div className="p-3 bg-cobalt/5 border-2 border-dashed border-cobalt/40 rounded-lg text-xs leading-relaxed">
                <span className="font-mono font-bold text-cobalt block mb-0.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Calibration Style Preview:</span>
                </span>
                <p className="text-muted font-sans">{depthPreviews[reviewDepth]}</p>
              </div>
            </div>

            {/* Min Severity to Post */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 font-mono text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Minimum Severity to Post</label>
                <select
                  value={minSeverity}
                  onChange={(e) => {
                    setMinSeverity(e.target.value as any);
                    markDirty();
                  }}
                  className="w-full px-3 py-2 bg-surface-2 border-2 border-ink rounded-lg font-bold"
                >
                  <option value="info">Info (All observations)</option>
                  <option value="suggestion">Suggestion (Recommended improvements)</option>
                  <option value="warning">Warning (Likely bugs & anti-patterns)</option>
                  <option value="critical">Critical Only (High risk & security only)</option>
                </select>
                <span className="text-[10px] text-muted mt-1 block">
                  Findings below this threshold will not post inline comments to GitHub.
                </span>
              </div>

              {/* Max inline comments slider */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-ink">Max Inline Comments per PR</label>
                  <span className="font-bold text-cobalt px-2 py-0.5 bg-cobalt/10 border border-cobalt rounded">
                    {maxComments} comments
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="20"
                  value={maxComments}
                  onChange={(e) => {
                    setMaxComments(Number(e.target.value));
                    markDirty();
                  }}
                  className="w-full accent-cobalt cursor-pointer"
                />
                <span className="text-[10px] text-muted mt-1 block">
                  Prevents review fatigue. Excess findings roll into the PR summary comment table.
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: PR Gate Enforcement */}
          <div className="bg-surface p-6 rounded-xl border-3 border-ink shadow-brutal space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-coral" />
              <h2 className="font-display font-extrabold text-lg text-ink">GitHub Checks API PR Gate</h2>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Enforce repository merging standards via GitHub commit status checks.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              {[
                {
                  id: 'off',
                  title: 'Off',
                  desc: 'Never post failure check runs. All PRs pass gate.',
                },
                {
                  id: 'advisory',
                  title: 'Advisory Mode',
                  desc: 'Posts neutral check run on critical findings without blocking PR merge.',
                },
                {
                  id: 'blocking',
                  title: 'Blocking on Critical',
                  desc: 'Marks GitHub check run as action_required / failure on Critical findings.',
                },
              ].map((m) => {
                const isSelected = gateMode === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      setGateMode(m.id as any);
                      markDirty();
                    }}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-coral/10 border-coral shadow-brutal-sm ring-1 ring-coral'
                        : 'bg-surface-2 border-ink/20 hover:border-ink'
                    }`}
                  >
                    <span className="font-bold text-ink block mb-1">{m.title}</span>
                    <p className="text-[11px] text-muted font-sans leading-normal">{m.desc}</p>
                  </div>
                );
              })}
            </div>

            {gateMode === 'blocking' && (
              <div className="p-3 bg-coral/15 border-2 border-coral rounded-lg text-xs leading-relaxed flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-coral shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-coral block">Blocking Mode Active</span>
                  <span className="text-ink">
                    If any critical security flaw (e.g. SQL Injection or Hardcoded Secret) is detected, MentorLens will report a failing check run to GitHub. PR author must apply the fix or have a lead dismiss the check before merging.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Footer with Dirty State Indicator */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-paper/90 backdrop-blur-md border-t-3 border-ink px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-xs">
            {isDirty ? (
              <span className="inline-flex items-center gap-1.5 text-tangerine font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-tangerine animate-pulse" />
                Unsaved changes pending
              </span>
            ) : isSaved ? (
              <span className="inline-flex items-center gap-1.5 text-mint font-bold">
                <Check className="w-4 h-4" />
                Changes saved successfully!
              </span>
            ) : (
              <span className="text-muted">All settings synchronized</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="btn-brutal px-3.5 py-2 bg-surface text-ink border-2 border-ink rounded-lg font-mono text-xs font-bold shadow-brutal-sm hover:bg-sand"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className="btn-brutal inline-flex items-center gap-2 px-5 py-2 bg-cobalt text-white border-2 border-ink rounded-lg font-mono text-xs font-bold shadow-brutal disabled:opacity-40"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Reset */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset Settings to Defaults?"
        message="Are you sure you want to revert all review rules, ignore patterns, and PR gate thresholds back to default values?"
        confirmLabel="Reset to Defaults"
        isDestructive={true}
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import LoginPage from './pages/Login';
import OnboardingReposPage from './pages/OnboardingRepos';
import OnboardingIndexPage from './pages/OnboardingIndex';
import DashboardPage from './pages/Dashboard';
import PRQueuePage from './pages/PRQueue';
import PRReviewDetailPage from './pages/PRReviewDetail';
import RunTracePage from './pages/RunTrace';
import MemoryExplorerPage from './pages/MemoryExplorer';
import DeveloperProgressPage from './pages/DeveloperProgress';
import TeamAnalyticsPage from './pages/TeamAnalytics';
import EvaluationPage from './pages/Evaluation';
import SettingsRulesPage from './pages/SettingsRules';
import SettingsIntegrationsPage from './pages/SettingsIntegrations';
import SystemStatesPage from './pages/SystemStates';
import DemoModePage from './pages/DemoMode';
import { 
  Eye, 
  GitPullRequest, 
  Database, 
  TrendingUp, 
  BarChart3, 
  Settings, 
  Sun, 
  Moon, 
  Search,
  ChevronDown
} from 'lucide-react';

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const navLinks = [
    { label: 'Dashboard', path: '/', icon: BarChart3 },
    { label: 'Pull Requests', path: '/prs', icon: GitPullRequest },
    { label: 'Memory', path: '/memory', icon: Database },
    { label: 'Progress', path: '/developers/meera', icon: TrendingUp },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  ];

  const isLoginPage = location.pathname === '/login';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Floating Glass Top Bar */}
      {!isLoginPage && (
        <header className="sticky top-3 z-50 px-4 flex justify-center">
        <nav 
          aria-label="Main Navigation"
          className="w-full max-w-7xl mx-auto nav-glass rounded-xl border-2 border-ink shadow-brutal px-4 py-2.5 flex items-center justify-between"
        >
          {/* Brand */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight">
              <span className="w-8 h-8 rounded-md bg-cobalt text-white flex items-center justify-center border-2 border-ink shadow-brutal-sm">
                <Eye className="w-4 h-4 stroke-[2.5]" />
              </span>
              <span>MentorLens</span>
            </Link>

            {/* Repo Switcher */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-surface border-2 border-ink rounded-md shadow-brutal-sm text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-mint"></span>
              <span className="font-mono text-xs">campus-portal</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted" />
            </div>
          </div>

          {/* Nav Links */}
          <div className="hidden lg:flex items-center gap-1 font-medium text-sm">
            {navLinks.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                    active
                      ? 'bg-cobalt text-white border-2 border-ink shadow-brutal-sm font-semibold'
                      : 'hover:bg-surface-2 text-ink'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Actions & Utilities */}
          <div className="flex items-center gap-2">
            <button
              aria-label="Quick Search"
              className="hidden sm:flex items-center gap-2 px-2.5 py-1 text-xs font-mono bg-surface border-2 border-ink rounded-md shadow-brutal-sm text-muted hover:text-ink"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Cmd+K</span>
            </button>

            <button
              onClick={() => setIsDark(!isDark)}
              aria-label="Toggle Theme"
              className="w-8 h-8 flex items-center justify-center rounded-md bg-surface border-2 border-ink shadow-brutal-sm hover:translate-y-[-1px] transition-transform"
            >
              {isDark ? <Sun className="w-4 h-4 text-sun" /> : <Moon className="w-4 h-4" />}
            </button>

            <Link
              to="/settings/integrations"
              aria-label="Settings"
              className="w-8 h-8 flex items-center justify-center rounded-md bg-surface border-2 border-ink shadow-brutal-sm hover:translate-y-[-1px] transition-transform"
            >
              <Settings className="w-4 h-4" />
            </Link>

            {/* Avatar */}
            <div className="w-8 h-8 rounded-md bg-tangerine border-2 border-ink shadow-brutal-sm font-mono text-xs font-bold text-white flex items-center justify-center">
              MS
            </div>
          </div>
        </nav>
      </header>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 w-full ${isLoginPage ? 'p-0' : 'max-w-7xl mx-auto p-4 sm:p-6 lg:p-8'}`}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding/repos" element={<OnboardingReposPage />} />
          <Route path="/onboarding/index" element={<OnboardingIndexPage />} />
          <Route path="/" element={<DashboardPage />} />
          <Route path="/prs" element={<PRQueuePage />} />
          <Route path="/prs/:id" element={<PRReviewDetailPage />} />
          <Route path="/runs/:id" element={<RunTracePage />} />
          <Route path="/memory" element={<MemoryExplorerPage />} />
          <Route path="/developers/:login" element={<DeveloperProgressPage />} />
          <Route path="/analytics" element={<TeamAnalyticsPage />} />
          <Route path="/evaluation" element={<EvaluationPage />} />
          <Route path="/settings" element={<SettingsRulesPage />} />
          <Route path="/settings/rules" element={<SettingsRulesPage />} />
          <Route path="/settings/integrations" element={<SettingsIntegrationsPage />} />
          <Route path="/settings/*" element={<SettingsRulesPage />} />
          <Route path="/system-states" element={<SystemStatesPage />} />
          <Route path="/demo" element={<DemoModePage />} />
          <Route path="*" element={<SystemStatesPage />} />
        </Routes>
      </main>
    </div>
  );
}

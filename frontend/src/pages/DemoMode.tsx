import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Play, 
  RotateCcw, 
  Wifi, 
  WifiOff, 
  Radio, 
  Sparkles, 
  GitPullRequest, 
  ShieldCheck, 
  Terminal,
  ExternalLink
} from 'lucide-react';
import { ShaChip } from '../components/Badges';

interface FeedEvent {
  id: string;
  time: string;
  stage: string;
  message: string;
  type: 'info' | 'success' | 'warning';
}

export default function DemoModePage() {
  const [tunnelUp, setTunnelUp] = useState(true);
  const [offlineReplayMode, setOfflineReplayMode] = useState(false);
  const [prCreated, setPrCreated] = useState(false);
  const [feed, setFeed] = useState<FeedEvent[]>([
    {
      id: 'e-1',
      time: '12:00:01',
      stage: 'System Ready',
      message: 'Demo environment initialized on mentorlens-demo repository',
      type: 'info',
    },
    {
      id: 'e-2',
      time: '12:00:03',
      stage: 'ChromaDB',
      message: 'Loaded 8 seeded bug-fix commit vectors into team memory',
      type: 'success',
    },
  ]);

  const seededBugs = [
    { sha: 'a3f21c9', title: 'SQL Injection via format string in get_student()', category: 'SQL Injection', checked: true },
    { sha: 'd7e108f', title: 'Mutable default argument in schedule_courses(courses=[])', category: 'Mutable Default', checked: true },
    { sha: 'b8210fe', title: 'Unclosed file descriptor in export_certificate()', category: 'Unclosed File', checked: true },
    { sha: 'c1998af', title: 'Hardcoded test stripe webhook key in config', category: 'Hardcoded Secret', checked: true },
    { sha: 'e44120a', title: 'Bare except clause suppressing OperationalError', category: 'Bare Except', checked: true },
    { sha: 'f55219b', title: 'Unsafe pickle.loads in student session cache', category: 'Insecure Deserialization', checked: true },
    { sha: '9182aac', title: 'Check-then-act race condition in course quota check', category: 'Race Condition', checked: true },
    { sha: '7712cae', title: 'Missing input validation on negative credit count', category: 'Input Validation', checked: true },
  ];

  const handleResetDemo = () => {
    setFeed([
      {
        id: `e-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        stage: 'Demo Reset',
        message: 'Resetting demo database and restoring 8 ground-truth commits...',
        type: 'info',
      },
    ]);
    setPrCreated(false);
  };

  const handleCreateDemoPR = () => {
    setPrCreated(true);
    const newEvents: FeedEvent[] = [
      {
        id: `e-${Date.now()}-1`,
        time: new Date().toLocaleTimeString(),
        stage: 'Webhook Received',
        message: 'POST /api/webhooks (X-GitHub-Delivery: pr-104-opened)',
        type: 'info',
      },
      {
        id: `e-${Date.now()}-2`,
        time: new Date().toLocaleTimeString(),
        stage: 'Diff Fetched',
        message: 'Fetched 1 file (campus_portal/controllers/registration.py, +18 -4 lines)',
        type: 'info',
      },
      {
        id: `e-${Date.now()}-3`,
        time: new Date().toLocaleTimeString(),
        stage: 'Retriever Agent',
        message: 'Vector similarity query matched SHA a3f21c9 (similarity 0.88 >= 0.40)',
        type: 'success',
      },
      {
        id: `e-${Date.now()}-4`,
        time: new Date().toLocaleTimeString(),
        stage: 'Verifier Agent',
        message: 'Approved citation a3f21c9: Commit verified in git tree & diff touches query',
        type: 'success',
      },
      {
        id: `e-${Date.now()}-5`,
        time: new Date().toLocaleTimeString(),
        stage: 'Post to GitHub',
        message: 'Posted pedagogical review comment with verified citation + set Check gate to Action Required',
        type: 'success',
      },
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < newEvents.length) {
        setFeed((prev) => [newEvents[i], ...prev]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 600);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="bg-surface p-5 sm:p-6 rounded-xl border-3 border-ink shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-5 h-5 text-cobalt animate-pulse" />
            <h1 className="font-display font-extrabold text-2xl text-ink">Demo Mode Control Panel</h1>
          </div>
          <p className="text-xs text-muted font-mono">
            Interactive demonstration panel for project defense, evaluation, and live reviewer presentation.
          </p>
        </div>

        {/* Demo Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleResetDemo}
            className="btn-brutal inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface text-ink border-2 border-ink rounded-lg font-mono text-xs font-bold shadow-brutal-sm hover:bg-sand"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo</span>
          </button>

          <button
            onClick={() => setTunnelUp(!tunnelUp)}
            className="px-2.5 py-1 text-xs font-mono bg-surface-2 border-2 border-ink rounded-lg shadow-brutal-sm hover:bg-sand"
          >
            {tunnelUp ? 'Simulate Tunnel Down' : 'Restore Tunnel'}
          </button>

          <button
            onClick={handleCreateDemoPR}
            disabled={prCreated}
            className="btn-brutal inline-flex items-center gap-1.5 px-4 py-1.5 bg-cobalt text-white border-2 border-ink rounded-lg font-mono text-xs font-bold shadow-brutal disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{prCreated ? 'Demo PR Active' : 'Create Demo PR'}</span>
          </button>
        </div>
      </div>

      {/* Prominent Tunnel Down Banner with 1-Click Offline Replay */}
      {!tunnelUp && (
        <div className="p-4 bg-coral/15 border-3 border-coral rounded-xl shadow-brutal space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-coral font-bold text-sm">
              <WifiOff className="w-5 h-5" />
              <span>Webhook Ingress Tunnel Down (ngrok / Cloudflare Tunnel Disconnected)</span>
            </div>
            <span className="px-2 py-0.5 bg-coral/20 border border-coral text-coral rounded font-mono text-xs font-bold">
              No Cloud Connection
            </span>
          </div>

          <p className="text-xs text-ink leading-relaxed">
            GitHub webhook deliveries cannot reach this local environment. To ensure a bulletproof live demo without external network dependencies, switch to offline deterministic replay mode.
          </p>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => {
                setOfflineReplayMode(true);
                handleCreateDemoPR();
              }}
              className="btn-brutal px-4 py-2 bg-cobalt text-white border-2 border-ink rounded-lg font-mono text-xs font-bold shadow-brutal"
            >
              Switch to Offline Replay & Run Demo →
            </button>
            <span className="text-xs font-mono text-muted">
              Uses pre-recorded local PR diff and fixtures
            </span>
          </div>
        </div>
      )}

      {/* 3-Step Live Demo Guide */}
      <div className="bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-3">
        <h3 className="font-display font-extrabold text-base text-ink flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cobalt" />
          <span>3-Step Live Demonstration Walkthrough</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
          <div className="p-3 bg-surface-2 border-2 border-ink rounded-lg space-y-1">
            <span className="text-[10px] text-muted block uppercase">Step 1</span>
            <div className="flex items-center gap-1.5 font-bold text-ink">
              {tunnelUp ? (
                <Wifi className="w-4 h-4 text-mint" />
              ) : (
                <WifiOff className="w-4 h-4 text-coral" />
              )}
              <span>Webhook Tunnel</span>
            </div>
            <p className="text-[11px] text-muted font-sans">
              {tunnelUp ? 'Active & listening on port 8000' : 'Offline (replay ready)'}
            </p>
          </div>

          <div className="p-3 bg-surface-2 border-2 border-ink rounded-lg space-y-1">
            <span className="text-[10px] text-muted block uppercase">Step 2</span>
            <div className="flex items-center gap-1.5 font-bold text-ink">
              <GitPullRequest className="w-4 h-4 text-cobalt" />
              <span>Open PR with Mistake</span>
            </div>
            <p className="text-[11px] text-muted font-sans">
              Click &quot;Create Demo PR&quot; above or push code introducing SQL query string formatting.
            </p>
          </div>

          <div className="p-3 bg-surface-2 border-2 border-ink rounded-lg space-y-1">
            <span className="text-[10px] text-muted block uppercase">Step 3</span>
            <div className="flex items-center gap-1.5 font-bold text-ink">
              <ShieldCheck className="w-4 h-4 text-mint" />
              <span>Watch Review Appear</span>
            </div>
            <p className="text-[11px] text-muted font-sans">
              Live multi-agent pipeline extracts diff, cites SHA a3f21c9, and posts pedagogical guidance.
            </p>
          </div>
        </div>
      </div>

      {/* 2-Column: Seeded Commits Checklist (Left) + Live Activity Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Seeded Commits Checklist (6 cols) */}
        <div className="lg:col-span-6 bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-extrabold text-lg text-ink">
                Seeded Repository Institutional Memory
              </h3>
              <p className="text-xs text-muted font-mono">
                8 deliberate historical bug fixes in <strong className="text-ink">mentorlens-demo</strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {offlineReplayMode && (
                <span className="px-2 py-0.5 bg-sun/30 border border-sun text-ink font-mono text-xs font-bold rounded">
                  Offline Replay Mode
                </span>
              )}
              <span className="px-2 py-0.5 bg-mint/20 border border-mint text-ink font-mono text-xs font-bold rounded">
                8 Vectors Ready
              </span>
            </div>
          </div>

          <div className="space-y-2 font-mono text-xs divide-y divide-ink/10">
            {seededBugs.map((bug) => (
              <div key={bug.sha} className="pt-2 flex items-start gap-2.5">
                <span className="w-4 h-4 rounded bg-mint text-ink font-bold flex items-center justify-center border border-ink text-[10px] shrink-0 mt-0.5">
                  ✓
                </span>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <ShaChip sha={bug.sha} />
                    <span className="px-1.5 py-0.2 bg-surface-2 border rounded text-[10px] font-bold text-ink">
                      {bug.category}
                    </span>
                  </div>
                  <p className="text-[11px] font-sans text-ink font-medium leading-tight">
                    {bug.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Live Activity Feed (6 cols) */}
        <div className="lg:col-span-6 bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cobalt" />
              <h3 className="font-display font-extrabold text-lg text-ink">
                Live Pipeline Event Stream
              </h3>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-mint animate-pulse" />
          </div>

          <div className="p-3 bg-[#111111] text-paper rounded-xl border-2 border-ink font-mono text-xs min-h-[360px] max-h-[440px] overflow-y-auto space-y-2.5">
            {feed.map((item) => (
              <div key={item.id} className="p-2 bg-surface/5 border border-paper/10 rounded space-y-0.5 animate-in fade-in">
                <div className="flex items-center justify-between text-[10px] text-muted">
                  <span className="text-mint font-bold uppercase">{item.stage}</span>
                  <span>{item.time}</span>
                </div>
                <p className="text-[11px] text-paper leading-snug">{item.message}</p>
              </div>
            ))}
          </div>

          {prCreated && (
            <div className="pt-2">
              <Link
                to="/prs/pr-104"
                className="btn-brutal w-full py-2.5 bg-mint text-ink font-mono text-xs font-bold rounded-lg border-2 border-ink shadow-brutal flex items-center justify-center gap-2"
              >
                <span>Inspect Resulting Review in S06 Review Detail →</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

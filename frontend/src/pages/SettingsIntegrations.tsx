import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Key, 
  RotateCw, 
  CheckCircle2, 
  XCircle, 
  Check, 
  Layers, 
  Lock, 
  Bell, 
  Users, 
  FolderGit2, 
  Sliders,
  ShieldCheck,
  Clock,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { ConfirmDialog } from '../components/UIStates';

interface DeliveryItem {
  id: string;
  event: string;
  statusCode: number;
  durationMs: number;
  signatureValid: boolean;
  time: string;
}

export default function SettingsIntegrationsPage() {
  const [provider, setProvider] = useState<'claude' | 'openai'>('claude');
  const [apiKey, setApiKey] = useState('sk-ant-api03-99a812048f...');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const [webhookFailing, setWebhookFailing] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);
  const [dataRetention, setDataRetention] = useState('90 days');

  const deliveries: DeliveryItem[] = [
    {
      id: 'del-1',
      event: 'pull_request.opened',
      statusCode: webhookFailing ? 502 : 200,
      durationMs: 14,
      signatureValid: true,
      time: '12 min ago',
    },
    {
      id: 'del-2',
      event: 'pull_request.synchronize',
      statusCode: 200,
      durationMs: 18,
      signatureValid: true,
      time: '1 hour ago',
    },
    {
      id: 'del-3',
      event: 'pull_request_review_comment.created',
      statusCode: 200,
      durationMs: 11,
      signatureValid: true,
      time: '3 hours ago',
    },
    {
      id: 'del-4',
      event: 'installation_repositories.added',
      statusCode: 200,
      durationMs: 22,
      signatureValid: true,
      time: 'Yesterday',
    },
  ];

  const handleTestConnection = () => {
    setIsTestingKey(true);
    setKeyTestStatus('idle');
    setTimeout(() => {
      setIsTestingKey(false);
      setKeyTestStatus('success');
    }, 1000);
  };

  const handleRedeliver = (id: string) => {
    alert(`Triggered webhook redelivery for ${id}. Response: 200 OK.`);
  };

  const subNav = [
    { label: 'Repositories', path: '/settings/repos', icon: FolderGit2 },
    { label: 'Review Rules & Gate', path: '/settings/rules', icon: Sliders },
    { label: 'Integrations & Health', path: '/settings/integrations', icon: Key, active: true },
    { label: 'Notifications', path: '/settings/notifications', icon: Bell },
    { label: 'LLM & Limits', path: '/settings/llm', icon: Layers },
    { label: 'Data & Privacy', path: '/settings/privacy', icon: Lock },
    { label: 'Team & Access', path: '/settings/team', icon: Users },
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="bg-surface p-5 sm:p-6 rounded-xl border-3 border-ink shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-ink">Integrations & Health</h1>
          <p className="text-xs text-muted font-mono">
            GitHub App configuration, Webhook status, LLM keys, and API limits.
          </p>
        </div>

        {/* State Simulator */}
        <button
          onClick={() => setWebhookFailing(!webhookFailing)}
          className="btn-brutal px-3 py-1.5 bg-surface text-ink border-2 border-ink rounded-lg font-mono text-xs font-bold shadow-brutal-sm hover:bg-sand"
        >
          {webhookFailing ? 'Simulate Healthy Webhooks' : 'Simulate Failing Webhook (502)'}
        </button>
      </div>

      {/* Failing Webhook Alert Banner with Troubleshooting */}
      {webhookFailing && (
        <div className="p-4 bg-coral/15 border-3 border-coral rounded-xl shadow-brutal space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2 text-coral font-bold text-sm">
            <XCircle className="w-5 h-5" />
            <span>Webhook Delivery Failure: Bad Gateway (502)</span>
          </div>
          <p className="text-xs text-ink leading-relaxed">
            GitHub is unable to deliver webhook payloads to your MentorLens webhook intake URL.
          </p>
          <div className="text-xs font-mono space-y-1 text-ink pt-1 pl-4 border-l-2 border-coral">
            <div>1. Check that your cloud ingress tunnel (ngrok / smee) is active and connected.</div>
            <div>2. Verify the <code>WEBHOOK_SECRET</code> matches the configured GitHub App secret.</div>
            <div>3. Test local FastAPI server health: <code>GET http://localhost:8000/ready</code>.</div>
          </div>
        </div>
      )}

      {/* 2-Column: Left Sub-navigation + Right Content Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sub-navigation (3 cols) */}
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

        {/* Right Settings Cards (9 cols) */}
        <div className="lg:col-span-9 space-y-6">
          {/* Card 1: GitHub App Connection Status */}
          <div className="bg-surface p-6 rounded-xl border-3 border-ink shadow-brutal space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-2 border-2 border-ink flex items-center justify-center font-bold">
                  GH
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-lg text-ink">
                    GitHub App Connection
                  </h3>
                  <p className="text-xs text-muted font-mono">
                    Installed on <strong className="text-ink">university-dev-club</strong> (ID: 489210)
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-mint/20 border-2 border-mint text-ink font-mono text-xs font-bold rounded-full">
                <CheckCircle2 className="w-4 h-4 text-mint" />
                <span>Connected & Verified</span>
              </span>
            </div>

            <div className="p-3 bg-surface-2 border border-ink/20 rounded-lg font-mono text-xs space-y-1">
              <span className="font-bold text-ink block">Active App Permissions:</span>
              <div className="flex flex-wrap gap-2 text-[11px] text-muted">
                <span className="px-1.5 py-0.5 bg-surface border rounded">• Pull Requests (Read & Write)</span>
                <span className="px-1.5 py-0.5 bg-surface border rounded">• Commit Status / Checks (Read & Write)</span>
                <span className="px-1.5 py-0.5 bg-surface border rounded">• Repository Contents (Read-only)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => window.open('https://github.com/settings/apps', '_blank')}
                className="btn-brutal inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface text-ink border-2 border-ink rounded-lg font-mono text-xs font-bold shadow-brutal-sm hover:bg-sand"
              >
                <span>Reconfigure on GitHub</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                className="btn-brutal px-3.5 py-1.5 bg-coral/20 text-coral border-2 border-coral rounded-lg font-mono text-xs font-bold shadow-brutal-sm hover:bg-coral hover:text-white"
              >
                Disconnect App
              </button>
            </div>
          </div>

          {/* Card 2: Webhook Health */}
          <div className="bg-surface p-6 rounded-xl border-3 border-ink shadow-brutal space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-extrabold text-lg text-ink">Webhook Health</h3>
                <p className="text-xs text-muted font-mono">Recent deliveries verified by HMAC signature</p>
              </div>

              <span className="font-mono text-xs text-muted">Last 20 deliveries</span>
            </div>

            <div className="overflow-x-auto border-2 border-ink rounded-lg">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className="bg-surface-2 border-b-2 border-ink text-ink uppercase">
                  <tr>
                    <th className="p-2.5">Event</th>
                    <th className="p-2.5">Status Code</th>
                    <th className="p-2.5">Duration</th>
                    <th className="p-2.5">Signature</th>
                    <th className="p-2.5">Time</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/15 text-[11px]">
                  {deliveries.map((del) => (
                    <tr key={del.id} className="hover:bg-sand/30">
                      <td className="p-2.5 font-bold text-ink">{del.event}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded border font-bold ${
                            del.statusCode === 200
                              ? 'bg-mint/20 border-mint text-ink'
                              : 'bg-coral/20 border-coral text-coral'
                          }`}
                        >
                          {del.statusCode} {del.statusCode === 200 ? 'OK' : 'Error'}
                        </span>
                      </td>
                      <td className="p-2.5">{del.durationMs}ms</td>
                      <td className="p-2.5">
                        <span className="inline-flex items-center gap-1 text-mint font-bold">
                          <Check className="w-3.5 h-3.5" />
                          <span>HMAC Valid</span>
                        </span>
                      </td>
                      <td className="p-2.5 text-muted">{del.time}</td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => handleRedeliver(del.id)}
                          className="btn-brutal px-2 py-0.5 bg-surface border border-ink rounded text-[10px] font-bold shadow-brutal-sm hover:bg-sand"
                        >
                          <RotateCw className="w-3 h-3 inline mr-1" />
                          Redeliver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 3: LLM Provider & Monthly Cost Cap */}
          <div className="bg-surface p-6 rounded-xl border-3 border-ink shadow-brutal space-y-4">
            <h3 className="font-display font-extrabold text-lg text-ink">
              LLM Provider & Cost Budget
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setProvider('claude')}
                    className={`p-2.5 rounded-lg border-2 font-bold text-center transition-all ${
                      provider === 'claude'
                        ? 'bg-cobalt text-white border-ink shadow-brutal-sm'
                        : 'bg-surface-2 border-ink/20 text-ink'
                    }`}
                  >
                    Claude 3.5 Sonnet
                  </button>
                  <button
                    onClick={() => setProvider('openai')}
                    className={`p-2.5 rounded-lg border-2 font-bold text-center transition-all ${
                      provider === 'openai'
                        ? 'bg-cobalt text-white border-ink shadow-brutal-sm'
                        : 'bg-surface-2 border-ink/20 text-ink'
                    }`}
                  >
                    OpenAI GPT-4o
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">API Key</label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1 px-3 py-2 bg-surface-2 border-2 border-ink rounded-lg font-mono text-xs focus:ring-2 focus:ring-tangerine"
                  />
                  <button
                    onClick={handleTestConnection}
                    disabled={isTestingKey}
                    className="btn-brutal px-3 py-2 bg-surface text-ink border-2 border-ink rounded-lg font-bold text-xs shadow-brutal-sm hover:bg-sand"
                  >
                    {isTestingKey ? 'Testing...' : 'Test Key'}
                  </button>
                </div>
                {keyTestStatus === 'success' && (
                  <span className="text-[11px] text-mint font-bold flex items-center gap-1 mt-1">
                    <Check className="w-3.5 h-3.5" /> Connection verified (Latency: 210ms)
                  </span>
                )}
              </div>
            </div>

            {/* Monthly Cost Cap Progress Bar */}
            <div className="p-4 bg-surface-2 border-2 border-ink rounded-lg space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-ink block">Monthly LLM Cost Cap</span>
                  <span className="text-muted text-[11px]">85% threshold reached (Alert active)</span>
                </div>
                <span className="font-bold text-tangerine text-sm">$42.50 / $50.00</span>
              </div>

              <div className="w-full h-3 bg-surface border-2 border-ink rounded-full overflow-hidden p-0.5">
                <div className="h-full bg-tangerine rounded-full" style={{ width: '85%' }} />
              </div>
              <p className="text-[10px] text-muted">
                If the 100% cost cap ($50.00) is hit, MentorLens gracefully falls back to static-analysis-only comments until the monthly cycle resets.
              </p>
            </div>
          </div>

          {/* Card 4: Rate Limit Timers */}
          <div className="bg-surface p-6 rounded-xl border-3 border-ink shadow-brutal space-y-4">
            <h3 className="font-display font-extrabold text-lg text-ink">API Rate Limit Status</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              <div className="p-3 bg-surface-2 border-2 border-ink rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">GitHub REST API</span>
                  <span className="text-mint font-bold">4,820 / 5,000 remaining</span>
                </div>
                <div className="flex items-center gap-1 text-muted text-[11px]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Resets in 18 minutes</span>
                </div>
              </div>

              <div className="p-3 bg-surface-2 border-2 border-ink rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">LLM Provider TPM</span>
                  <span className="text-mint font-bold">38,200 / 40,000 TPM</span>
                </div>
                <div className="flex items-center gap-1 text-muted text-[11px]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Resets in 12 minutes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 5: Data & Privacy Danger Zone */}
          <div className="bg-surface p-6 rounded-xl border-3 border-ink shadow-brutal space-y-4">
            <h3 className="font-display font-extrabold text-lg text-ink">Data, Privacy & Security</h3>

            {/* Secret Redaction Toggle (Locked) */}
            <div className="p-3.5 bg-mint/15 border-2 border-mint rounded-lg flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-mono text-xs font-bold text-ink flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-mint" />
                  <span>Automatic Secret Redaction (Active & Enforced)</span>
                </span>
                <p className="text-[11px] text-muted">
                  AWS keys, tokens, and passwords are unconditionally scrubbed from diffs before transmission to the LLM.
                </p>
              </div>

              <div className="flex items-center gap-1 px-2.5 py-1 bg-surface border border-mint rounded text-xs font-mono font-bold text-mint">
                <Lock className="w-3.5 h-3.5" />
                <span>Locked ON</span>
              </div>
            </div>

            {/* Data Retention */}
            <div className="flex items-center justify-between font-mono text-xs pt-1">
              <div>
                <span className="font-bold text-ink block">Data Retention Policy</span>
                <span className="text-muted text-[11px]">
                  How long review traces and vector embeddings are stored.
                </span>
              </div>

              <select
                value={dataRetention}
                onChange={(e) => setDataRetention(e.target.value)}
                className="px-3 py-1.5 bg-surface-2 border-2 border-ink rounded-lg font-bold"
              >
                <option>30 days</option>
                <option>60 days</option>
                <option>90 days</option>
                <option>1 year</option>
              </select>
            </div>

            {/* Danger Zone */}
            <div className="pt-3 border-t-2 border-coral/30 space-y-3">
              <span className="font-mono text-xs font-bold text-coral uppercase block">Danger Zone</span>
              <div className="p-3 bg-coral/10 border-2 border-coral rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-ink text-xs block">Delete All Repository Data</span>
                  <span className="text-[11px] text-muted">
                    Irreversibly deletes all institutional memory vectors, review runs, and developer stats.
                  </span>
                </div>
                <button
                  onClick={() => setShowDeleteDataConfirm(true)}
                  className="btn-brutal px-3.5 py-1.5 bg-coral text-white font-mono text-xs font-bold rounded-lg border-2 border-ink shadow-brutal-sm"
                >
                  <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                  Delete Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disconnect App Confirmation */}
      <ConfirmDialog
        isOpen={showDisconnectConfirm}
        title="Disconnect GitHub App?"
        message="MentorLens will immediately stop receiving pull request webhooks and reviewing code for university-dev-club."
        confirmLabel="Disconnect App"
        isDestructive={true}
        onConfirm={() => {
          setShowDisconnectConfirm(false);
          alert('GitHub App disconnected.');
        }}
        onCancel={() => setShowDisconnectConfirm(false)}
      />

      {/* Delete Data Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDataConfirm}
        title="Permanently Delete All Data?"
        message="This action CANNOT be undone. All indexed bug-fix commits, embeddings in ChromaDB, and review traces will be purged immediately."
        confirmLabel="Permanently Delete Data"
        isDestructive={true}
        onConfirm={() => {
          setShowDeleteDataConfirm(false);
          alert('All repository data purged.');
        }}
        onCancel={() => setShowDeleteDataConfirm(false)}
      />
    </div>
  );
}

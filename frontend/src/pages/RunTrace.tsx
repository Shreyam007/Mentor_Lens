import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  CheckCircle2, 
  XCircle, 
  RotateCw, 
  Layers, 
  Copy, 
  Check, 
  ChevronRight, 
  ShieldCheck, 
  Terminal,
  ChevronDown
} from 'lucide-react';
import { VerifiedBadge, ShaChip } from '../components/Badges';

interface PipelineNode {
  id: string;
  name: string;
  type: 'system' | 'agent' | 'github';
  status: 'success' | 'failed' | 'retrying';
  durationMs: number;
  tokens?: { prompt: number; completion: number; total: number };
  cost?: string;
  retries?: number;
  input: Record<string, any>;
  output: Record<string, any>;
}

export default function RunTracePage() {
  const { id = 'run-9941' } = useParams();
  const [activeFrame, setActiveFrame] = useState<'all_green' | 'retrying' | 'timeout_fallback'>('all_green');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-verifier');
  const [selectedRun, setSelectedRun] = useState(`${id} (PR #104)`);
  const [copiedJson, setCopiedJson] = useState(false);

  // Nodes for the horizontal pipeline
  const nodes: PipelineNode[] = [
    {
      id: 'node-webhook',
      name: 'Webhook Intake',
      type: 'system',
      status: 'success',
      durationMs: 14,
      input: {
        event: 'pull_request.opened',
        delivery_id: 'd91a-4c22-b108',
        repo: 'campus-portal',
        sender: 'meera-sharma',
      },
      output: {
        action: 'enqueued',
        queue_job_id: 'job-984210',
        signature_verified: true,
      },
    },
    {
      id: 'node-diff',
      name: 'Diff Fetch',
      type: 'system',
      status: 'success',
      durationMs: 240,
      input: {
        base_sha: '7f8a12e',
        head_sha: '4a9b2ef',
        max_files: 50,
      },
      output: {
        files_fetched: 2,
        additions: 24,
        deletions: 5,
        hunks_parsed: 3,
      },
    },
    {
      id: 'node-static',
      name: 'Static Analysis',
      type: 'system',
      status: 'success',
      durationMs: 110,
      input: {
        linters: ['bandit', 'pylint', 'ast_syntax'],
        target_files: ['campus_portal/controllers/registration.py'],
      },
      output: {
        findings_count: 2,
        rules_triggered: ['B608', 'W0102'],
      },
    },
    {
      id: 'node-retriever',
      name: 'Retriever Agent',
      type: 'agent',
      status: activeFrame === 'retrying' ? 'retrying' : 'success',
      retries: activeFrame === 'retrying' ? 2 : 0,
      durationMs: 380,
      tokens: { prompt: 540, completion: 180, total: 720 },
      cost: '$0.0003',
      input: {
        query: 'SQL injection string formatting registrations student_id',
        collection: 'ml_team_memory_repo_1',
        k: 4,
      },
      output: {
        candidates_retrieved: 2,
        citations_found: [
          { sha: 'a3f21c9', similarity: 0.88 },
          { sha: 'd7e108f', similarity: 0.91 },
        ],
      },
    },
    {
      id: 'node-explainer',
      name: 'Explainer Agent',
      type: 'agent',
      status: activeFrame === 'timeout_fallback' ? 'failed' : 'success',
      durationMs: activeFrame === 'timeout_fallback' ? 5000 : 1240,
      tokens: { prompt: 1420, completion: 490, total: 1910 },
      cost: '$0.0028',
      input: {
        findings: 2,
        skill_level: 'intermediate',
        untrusted_pr_guarded: true,
      },
      output: activeFrame === 'timeout_fallback'
        ? { error: 'GatewayTimeout: LLM inference exceeded 5000ms. Falling back to static-analysis comments.' }
        : {
            synthesized_comments: 2,
            pedagogical_sections: ['why_risky', 'how_to_fix', 'past_citations'],
          },
    },
    {
      id: 'node-verifier',
      name: 'Verifier Agent',
      type: 'agent',
      status: 'success',
      durationMs: 190,
      tokens: { prompt: 420, completion: 90, total: 510 },
      cost: '$0.0006',
      input: {
        candidates: 2,
        rules: ['sha_exists', 'diff_similarity_gte_40', 'claim_matches', 'line_in_diff'],
      },
      output: {
        approved: 2,
        rejected: 0,
        unverified_stripped: 0,
      },
    },
    {
      id: 'node-post',
      name: 'Post to GitHub',
      type: 'github',
      status: 'success',
      durationMs: 310,
      input: {
        pr_number: 104,
        batch_comments: 2,
        gate_status: 'failure',
      },
      output: {
        github_review_id: 9812401,
        check_run_id: 4891029,
        comments_created: 2,
      },
    },
  ];

  // Verifier Decisions Table Data
  const verifierDecisions = [
    {
      sha: 'a3f21c9',
      finding: 'SQL Injection via String Interpolation',
      check1: 'Passed (Commit exists)',
      check2: '0.88 >= 0.40 (Touches registration query)',
      check3: 'Approved (Claim matches sanitize fix)',
      verdict: 'approved',
      reason: 'Valid institutional memory citation for portal auth query sanitization.',
    },
    {
      sha: 'd7e108f',
      finding: 'Mutable Default Argument',
      check1: 'Passed (Commit exists)',
      check2: '0.91 >= 0.40 (Touches course_codes list)',
      check3: 'Approved (Claim matches default list fix)',
      verdict: 'approved',
      reason: 'Valid precedent from exam_scheduler bug fix.',
    },
    {
      sha: '9999999',
      finding: 'Unused import sys',
      check1: 'Failed (Commit does not exist)',
      check2: '0.12 < 0.40 (Low similarity)',
      check3: 'Rejected (Hallucinated citation)',
      verdict: 'rejected',
      reason: 'Fail-closed: Stripped unverified citation, converted finding to general guidance.',
    },
  ];

  const activeNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify({ input: activeNode.input, output: activeNode.output }, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Frame Switcher Bar */}
      <div className="p-3 bg-surface-2 border-2 border-dashed border-ink/40 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <span className="text-muted">Test S07 Pipeline Trace States:</span>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all_green', 'All Green (Clean Trace)'],
              ['retrying', 'Node Retrying (Attempt 2 of 3)'],
              ['timeout_fallback', 'LLM Timeout Fallback'],
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

      {/* Top Header */}
      <div className="bg-surface p-5 sm:p-6 rounded-xl border-3 border-ink shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-mint" />
            <h1 className="font-display font-extrabold text-2xl text-ink">Agent Run Trace</h1>
          </div>
          <p className="text-xs text-muted font-mono">
            Pipeline Execution Inspector for Senior Reviewers & System Observability
          </p>
        </div>

        {/* Run Selector & Re-run */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedRun}
              onChange={(e) => setSelectedRun(e.target.value)}
              className="px-3 py-1.5 bg-surface border-2 border-ink rounded-lg shadow-brutal-sm font-mono text-xs font-bold text-ink pr-8 appearance-none cursor-pointer"
            >
              <option>run-9941 (PR #104)</option>
              <option>run-9938 (PR #103)</option>
              <option>run-9932 (PR #102)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          <button
            onClick={() => alert(`Re-running pipeline from stage: ${activeNode.name}`)}
            className="btn-brutal inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-cobalt text-white border-2 border-ink rounded-lg text-xs font-bold shadow-brutal-sm"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Re-run from {activeNode.name}</span>
          </button>
        </div>
      </div>

      {/* Horizontal Pipeline of Nodes */}
      <div className="bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="font-bold text-ink flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cobalt" />
            <span>Multi-Agent Review Pipeline Stages</span>
          </span>
          <span className="text-muted">Total Run Time: ~2.48s • Total Tokens: 3,140</span>
        </div>

        {/* Scrollable node timeline */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center gap-2 min-w-[840px] pt-2">
            {nodes.map((node, idx) => {
              const isSelected = selectedNodeId === node.id;
              const isRetrying = node.status === 'retrying';
              const isFailed = node.status === 'failed';

              return (
                <div key={node.id} className="flex items-center">
                  <button
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all min-w-[135px] ${
                      isSelected
                        ? 'border-ink bg-cobalt text-white shadow-brutal scale-[1.03]'
                        : isFailed
                        ? 'border-coral bg-coral/15 text-ink'
                        : isRetrying
                        ? 'border-sun bg-sun/20 text-ink'
                        : 'border-ink/20 bg-surface-2 text-ink hover:border-ink hover:bg-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[9px] font-mono uppercase px-1 rounded ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-surface text-muted border border-ink/20'
                      }`}>
                        {node.type}
                      </span>
                      {isFailed ? (
                        <XCircle className="w-4 h-4 text-coral" />
                      ) : isRetrying ? (
                        <RotateCw className="w-4 h-4 text-sun animate-spin" />
                      ) : (
                        <CheckCircle2 className={`w-4 h-4 ${isSelected ? 'text-mint' : 'text-mint'}`} />
                      )}
                    </div>

                    <p className="font-mono text-xs font-bold leading-tight">{node.name}</p>

                    <div className="mt-2 flex items-center justify-between text-[10px] font-mono opacity-80">
                      <span>{node.durationMs}ms</span>
                      {node.cost && <span>{node.cost}</span>}
                    </div>
                  </button>

                  {idx < nodes.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-muted mx-1 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2-Column: Inspector Drawer (Left) & Verifier Decisions Table (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Node JSON Inspector (5 Cols) */}
        <div className="lg:col-span-5 bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cobalt" />
              <h3 className="font-display font-extrabold text-lg text-ink">
                {activeNode.name} Inspector
              </h3>
            </div>

            <button
              onClick={handleCopyJson}
              className="btn-brutal px-2.5 py-1 bg-surface-2 border-2 border-ink rounded font-mono text-[11px] font-bold flex items-center gap-1 shadow-brutal-sm"
            >
              {copiedJson ? <Check className="w-3.5 h-3.5 text-mint" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>

          {/* Node Meta stats */}
          <div className="grid grid-cols-3 gap-2 font-mono text-xs">
            <div className="p-2 bg-surface-2 border border-ink/30 rounded">
              <span className="text-muted block text-[10px]">DURATION</span>
              <span className="font-bold">{activeNode.durationMs}ms</span>
            </div>
            <div className="p-2 bg-surface-2 border border-ink/30 rounded">
              <span className="text-muted block text-[10px]">TOKENS</span>
              <span className="font-bold">{activeNode.tokens?.total || 'N/A'}</span>
            </div>
            <div className="p-2 bg-surface-2 border border-ink/30 rounded">
              <span className="text-muted block text-[10px]">RETRIES</span>
              <span className="font-bold">{activeNode.retries || 0}</span>
            </div>
          </div>

          {/* Structured JSON Blocks */}
          <div className="space-y-3 font-mono text-xs">
            <div>
              <p className="text-[10px] text-muted uppercase font-bold mb-1">Input Payload</p>
              <pre className="p-3 bg-[#111111] text-paper rounded-lg border border-ink overflow-x-auto text-[11px] max-h-44">
                {JSON.stringify(activeNode.input, null, 2)}
              </pre>
            </div>

            <div>
              <p className="text-[10px] text-muted uppercase font-bold mb-1">Output Payload</p>
              <pre className="p-3 bg-[#111111] text-mint rounded-lg border border-ink overflow-x-auto text-[11px] max-h-44">
                {JSON.stringify(activeNode.output, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {/* Right Column: Verifier Decisions Table (7 Cols) */}
        <div className="lg:col-span-7 bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-mint" />
              <h3 className="font-display font-extrabold text-lg text-ink">
                Verifier Decisions & Citations
              </h3>
            </div>
            <span className="text-xs font-mono text-muted">Fail-Closed Verification</span>
          </div>

          <p className="text-xs text-muted leading-relaxed">
            The Verifier checks all retrieved commit SHAs against the local git tree, diff vector similarity (&ge;0.40), and claim alignment before posting.
          </p>

          <div className="overflow-x-auto border-2 border-ink rounded-lg">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="bg-surface-2 border-b-2 border-ink text-ink uppercase">
                <tr>
                  <th className="p-2.5">Cited SHA</th>
                  <th className="p-2.5">Rule / Finding</th>
                  <th className="p-2.5">Verification Checks</th>
                  <th className="p-2.5">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/15 text-[11px]">
                {verifierDecisions.map((v, i) => (
                  <tr key={i} className="hover:bg-sand/30">
                    <td className="p-2.5 align-top">
                      <ShaChip sha={v.sha} />
                    </td>
                    <td className="p-2.5 align-top">
                      <p className="font-bold text-ink">{v.finding}</p>
                      <p className="text-[10px] text-muted mt-0.5">{v.reason}</p>
                    </td>
                    <td className="p-2.5 align-top space-y-0.5 text-[10px]">
                      <div>• {v.check1}</div>
                      <div>• {v.check2}</div>
                      <div>• {v.check3}</div>
                    </td>
                    <td className="p-2.5 align-top">
                      {v.verdict === 'approved' ? (
                        <VerifiedBadge />
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-coral/20 border border-coral text-coral rounded font-bold text-[10px]">
                          Rejected
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Repository {
  id: string;
  full_name: string;
  default_branch: string;
  language_set: string[];
  index_status: string;
  indexed_at: string | null;
  pr_count?: number;
  open_finding_count?: number;
}

export interface FindingCitation {
  sha: string;
  verdict: 'approved' | 'rejected' | 'citation_stripped';
  reason: string;
  similarity: number;
}

export interface Finding {
  id: string;
  file?: string;
  file_path?: string;
  line_start: number;
  line_end: number;
  category: string;
  severity: 'critical' | 'warning' | 'suggestion' | 'info';
  title: string;
  why_risky: string;
  fix: string;
  suggested_code?: string | null;
  status: 'open' | 'fixed' | 'dismissed' | 'outdated';
  citations: FindingCitation[];
}

export interface PullRequestDetail {
  id: string;
  number: number;
  title: string;
  author: string;
  repo_name: string;
  head_sha: string;
  base_branch: string;
  state: string;
  run?: {
    id: string | null;
    status: string;
    stage: string;
    trace: Record<string, any>;
  };
  findings: Finding[];
  skill_level: 'beginner' | 'intermediate' | 'advanced';
  diff_files?: Array<{
    filename: string;
    status?: string;
    additions?: number;
    deletions?: number;
    patch: string;
  }>;
}

export interface TeamStats {
  open_prs: number;
  active_rules: number;
  learning_velocity: number;
  prevented_regressions: number;
  weekly_mistakes: Array<{ week: string; count: number }>;
  recurring_mistakes: Array<{ category: string; count: number; change: string }>;
  recent_reviews: Array<{
    id: string;
    pr_number: number;
    repo: string;
    title: string;
    author: string;
    findings_count: number;
    verdict: string;
    time: string;
  }>;
}

export interface MemoryItem {
  id: string;
  sha: string;
  repo: string;
  message: string;
  category: string;
  author: string;
  date: string;
  diff_summary: string;
  excluded: boolean;
}

export interface DeveloperProgress {
  login: string;
  name: string;
  avatar_url?: string;
  skill_level: 'beginner' | 'intermediate' | 'advanced';
  clean_streak: number;
  total_reviews: number;
  mistakes_by_category: Array<{ category: string; count: number }>;
  learning_path: Array<{ title: string; status: 'completed' | 'in_progress' | 'upcoming'; desc: string }>;
  milestones: Array<{ date: string; title: string; detail: string }>;
}

export interface TeamAnalytics {
  mistake_heatmap: Array<{ day: string; hour: number; value: number }>;
  review_time_comparison: Array<{ week: string; human_hours: number; ai_minutes: number }>;
  senior_agreement_rate: number;
  category_breakdown: Array<{ category: string; count: number }>;
}

export interface EvaluationMetrics {
  citation_precision: number;
  hallucination_rate: number;
  developer_satisfaction: number;
  noise_reduction_rate: number;
  funnel: {
    retrieved_citations: number;
    verifier_screened: number;
    approved_citations: number;
    unverified_stripped: number;
  };
  samples: Array<{
    id: string;
    pr: string;
    rule: string;
    citation: string;
    status: string;
  }>;
}

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)ml_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export interface RateLimitDetail {
  retryAfter: number;
  tier?: string;
  message: string;
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Double Submit CSRF token on mutating requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf && !headers['X-CSRF-Token']) {
      headers['X-CSRF-Token'] = csrf;
    }
  }

  try {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    });

    if (res.status === 429) {
      const retryAfterHeader = res.headers.get('Retry-After');
      const errorBody = await res.json().catch(() => ({}));
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : (errorBody?.error?.retry_after || 60);
      const tier = errorBody?.error?.tier || res.headers.get('X-RateLimit-Tier') || 'API';
      const message = errorBody?.error?.message || `Rate limit reached. Try again in ${retryAfter}s.`;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<RateLimitDetail>('mentorlens:ratelimit', {
            detail: { retryAfter, tier, message },
          })
        );
      }

      throw new Error(`[429 RATE_LIMIT_EXCEEDED] ${message}`);
    }

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const message = errorBody?.error?.message || `HTTP error ${res.status}`;
      throw new Error(message);
    }

    return res.json();
  } catch (err: any) {
    throw err;
  }
}


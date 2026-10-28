import { useState, useEffect, type FormEvent } from 'react';
import { Eye, Github, Loader2, AlertCircle, ShieldCheck, Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { loginWithEmail, signupWithEmail, RateLimitDetail } from '../lib/api';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginHandle, setLoginHandle] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [lockoutCountdown, setLockoutCountdown] = useState<number | null>(null);

  // Field validation states
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const errorParam = searchParams.get('error');

  useEffect(() => {
    if (errorParam === 'cancelled') {
      setActiveError('OAuth authorization was cancelled. Please try again.');
    } else if (errorParam === 'expired') {
      setActiveError('Your session expired. Please sign in again.');
    }
  }, [errorParam]);

  // Rate-limit event listener from fetchApi
  useEffect(() => {
    const handleRateLimit = (e: Event) => {
      const custom = e as CustomEvent<RateLimitDetail>;
      setActiveError(custom.detail.message);
      if (custom.detail.retryAfter) {
        setLockoutCountdown(custom.detail.retryAfter);
      }
    };

    window.addEventListener('mentorlens:ratelimit', handleRateLimit);
    return () => window.removeEventListener('mentorlens:ratelimit', handleRateLimit);
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutCountdown === null || lockoutCountdown <= 0) return;
    const interval = setInterval(() => {
      setLockoutCountdown((prev: number | null) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setActiveError(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutCountdown]);

  const validateForm = (): boolean => {
    let valid = true;
    setEmailError(null);
    setPasswordError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setEmailError('Please enter a valid email address.');
      valid = false;
    }

    if (!password || password.length < 10) {
      setPasswordError('Password must be at least 10 characters long.');
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (lockoutCountdown !== null && lockoutCountdown > 0) return;
    if (!validateForm()) return;

    setIsLoading(true);
    setActiveError(null);

    try {
      if (tab === 'login') {
        await loginWithEmail(email, password);
      } else {
        await signupWithEmail(email, password, loginHandle || undefined);
      }
      navigate('/onboarding/repos');
    } catch (err: any) {
      const msg = err.message || 'Authentication failed. Please check your credentials.';
      setActiveError(msg);
      // Extract countdown if present in 429 / lockout message
      const match = msg.match(/wait (\d+) seconds/i) || msg.match(/in (\d+)s/i);
      if (match) {
        setLockoutCountdown(parseInt(match[1], 10));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubOAuth = () => {
    setIsLoading(true);
    window.location.href = '/api/auth/github';
  };

  const handleGoogleOAuth = () => {
    setIsLoading(true);
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen bg-[#111111] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Graphic Grid */}
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#F4EFE6 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Main 440px Neo-Brutalist Card */}
      <div className="w-full max-w-[440px] bg-paper text-ink p-7 rounded-xl border-3 border-ink shadow-[6px_6px_0px_0px_#FFFFFF] z-10 relative">
        {/* Brand Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-md bg-[#FF6B4A] text-white flex items-center justify-center border-2 border-ink shadow-[2px_2px_0px_#111111]">
              <Eye className="w-5 h-5 stroke-[2.5]" />
            </span>
            <span className="font-display text-2xl font-extrabold tracking-tight">MentorLens</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-[#FFE27A] border-2 border-ink font-mono text-[11px] font-bold">
            v1.0.0
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-xl font-extrabold text-ink leading-snug mb-1">
          {tab === 'login' ? 'Sign in to your team workspace' : 'Create your MentorLens account'}
        </h1>
        <p className="text-stone-600 text-xs leading-relaxed mb-5">
          Agentic AI code-review grounded in your team's real bugfixes.
        </p>

        {/* Tab Switcher (Neo-Brutalist Pill) */}
        <div className="flex items-center p-1 bg-stone-200 border-2 border-ink rounded-lg mb-5">
          <button
            type="button"
            onClick={() => { setTab('login'); setActiveError(null); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
              tab === 'login'
                ? 'bg-ink text-white shadow-[2px_2px_0px_#FFE27A]'
                : 'text-stone-700 hover:text-ink'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setActiveError(null); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
              tab === 'signup'
                ? 'bg-ink text-white shadow-[2px_2px_0px_#FFE27A]'
                : 'text-stone-700 hover:text-ink'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error / Lockout Alert */}
        {activeError && (
          <div
            role="alert"
            className="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded-lg flex items-start gap-2.5 text-xs font-semibold text-red-900 animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p>{activeError}</p>
              {lockoutCountdown !== null && (
                <p className="mt-1 font-mono text-[11px] text-red-700">
                  Rate-limit lockout active: <strong>{lockoutCountdown}s remaining</strong>
                </p>
              )}
            </div>
            <button
              onClick={() => setActiveError(null)}
              className="text-stone-500 hover:text-ink text-xs underline"
            >
              ×
            </button>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {tab === 'signup' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                Developer Handle / Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  value={loginHandle}
                  onChange={(e) => setLoginHandle(e.target.value)}
                  placeholder="e.g. alex-chen"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border-2 border-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
              Work Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                placeholder="developer@company.com"
                className={`w-full pl-9 pr-3 py-2 text-sm bg-white border-2 rounded-lg focus:outline-none focus:ring-2 ${
                  emailError ? 'border-red-500 focus:ring-red-400' : 'border-ink focus:ring-[#FF6B4A]'
                }`}
              />
            </div>
            {emailError && <p className="text-red-600 text-[11px] mt-1 font-medium">{emailError}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                Password
              </label>
              {tab === 'login' && (
                <span className="text-[11px] text-stone-500 hover:underline cursor-pointer">
                  Forgot?
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                placeholder={tab === 'signup' ? 'Min 10 chars (e.g. battery-staple)' : '••••••••••••'}
                className={`w-full pl-9 pr-3 py-2 text-sm bg-white border-2 rounded-lg focus:outline-none focus:ring-2 ${
                  passwordError ? 'border-red-500 focus:ring-red-400' : 'border-ink focus:ring-[#FF6B4A]'
                }`}
              />
            </div>
            {passwordError && <p className="text-red-600 text-[11px] mt-1 font-medium">{passwordError}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading || (lockoutCountdown !== null && lockoutCountdown > 0)}
            className="w-full py-2.5 px-4 bg-[#FF6B4A] hover:bg-[#e05a3b] text-white font-extrabold text-sm rounded-lg border-2 border-ink shadow-[3px_3px_0px_#111111] flex items-center justify-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>{tab === 'login' ? 'Sign In with Email' : 'Create Free Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-300" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-paper px-2 text-stone-500 font-bold font-mono text-[10px]">Or continue with</span>
          </div>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleGitHubOAuth}
            disabled={isLoading}
            className="py-2 px-3 bg-white hover:bg-stone-50 text-ink font-bold text-xs rounded-lg border-2 border-ink shadow-[2px_2px_0px_#111111] flex items-center justify-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
          >
            <Github className="w-4 h-4" />
            <span>GitHub</span>
          </button>

          <button
            type="button"
            onClick={handleGoogleOAuth}
            disabled={isLoading}
            className="py-2 px-3 bg-white hover:bg-stone-50 text-ink font-bold text-xs rounded-lg border-2 border-ink shadow-[2px_2px_0px_#111111] flex items-center justify-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Google</span>
          </button>
        </div>

        {/* Security badge subtext */}
        <div className="mt-4 pt-3 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-500 font-mono">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-mint" />
            <span>Argon2id + SameSite Cookies</span>
          </div>
          <a href="/" className="text-stone-900 font-bold hover:underline">
            Guest Demo →
          </a>
        </div>
      </div>

      {/* Operational Status */}
      <div className="mt-5 z-10 flex items-center gap-2 px-3 py-1 bg-surface text-paper border border-paper/30 rounded-full font-mono text-xs shadow-[2px_2px_0px_#111111]">
        <span className="w-2 h-2 rounded-full bg-mint animate-pulse" />
        <span>Enterprise Auth & Zero-Trust Active</span>
      </div>
    </div>
  );
}

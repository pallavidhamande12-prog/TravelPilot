import React, { useState } from 'react';
import { Compass, AlertCircle, ArrowRight, Sparkles, Copy, Check, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const SignInView: React.FC = () => {
  const { signInWithGoogle, signInAsDemo, error, clearError } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    clearError();
    try {
      await signInWithGoogle();
    } catch {
      // Handled in AuthContext
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDemoSignIn = () => {
    clearError();
    signInAsDemo();
  };

  const handleCopyOrigin = () => {
    if (currentOrigin) {
      navigator.clipboard.writeText(currentOrigin);
      setCopiedOrigin(true);
      setTimeout(() => setCopiedOrigin(false), 2000);
    }
  };

  const isRefererBlockedError =
    Boolean(error) &&
    (error?.toLowerCase().includes('requests-from-referer') ||
      error?.toLowerCase().includes('are-blocked') ||
      error?.toLowerCase().includes('authorized domains') ||
      error?.toLowerCase().includes('unauthorized-domain') ||
      error?.toLowerCase().includes('action is invalid') ||
      error?.toLowerCase().includes('invalid-action-code'));

  return (
    <div
      id="travelpilot-signin-page"
      className="min-h-screen flex flex-col justify-between bg-[#FAF8F5] text-[#1F2421] px-4 py-8"
    >
      {/* Top Brand Bar */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#2E5658] text-white flex items-center justify-center shadow-xs">
            <Compass className="w-5 h-5" />
          </div>
          <span className="font-semibold text-lg tracking-tight text-[#1F2421]">
            TravelPilot
          </span>
        </div>
        <Badge variant="neutral">Smart Travel Studio</Badge>
      </header>

      {/* Main Sign-In Hero Centerpiece */}
      <main className="max-w-lg w-full mx-auto my-auto py-8">
        <Card id="signin-card" variant="surface" className="p-8 sm:p-10 text-center shadow-sm space-y-6">
          {/* Brand Icon & Welcome */}
          <div className="space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center shadow-xs">
              <Compass className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1F2421]">
                TravelPilot
              </h1>
              <p className="text-sm text-[#5C6460] mt-1 font-medium">
                Intelligent Trip Planning &amp; Disruption Management
              </p>
            </div>
          </div>

          <p className="text-sm text-[#78716C] leading-relaxed">
            Plan multi-day trips with AI-curated pacing, dynamic budget tracking, and real-time disruption re-routing.
          </p>

          {/* Error Message if any */}
          {error && (
            <div
              id="signin-error-banner"
              className="p-4 rounded-xl bg-[#FFF8F6] border border-[#F3D5C8] text-xs text-left space-y-2.5"
            >
              <div className="flex items-start gap-2 text-[#CF8A70] font-semibold">
                {isRefererBlockedError ? (
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#CF8A70]" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#CF8A70]" />
                )}
                <span>
                  {isRefererBlockedError
                    ? 'Google Cloud Origin Restriction Detected'
                    : 'Authentication Note'}
                </span>
              </div>

              <p className="text-[#685F58] leading-relaxed">
                {isRefererBlockedError
                  ? 'Your current deployment domain is restricted by the Google API Key or Firebase Authorized Domains configuration.'
                  : error}
              </p>

              {isRefererBlockedError && currentOrigin && (
                <div className="space-y-2 pt-1">
                  <div className="p-2 rounded-lg bg-white border border-[#E8E2D9] font-mono text-[11px] text-[#2E5658] flex items-center justify-between gap-2 overflow-x-auto">
                    <span className="truncate">{currentOrigin}</span>
                    <button
                      type="button"
                      id="copy-origin-btn"
                      onClick={handleCopyOrigin}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded bg-[#FAF8F5] hover:bg-[#F2EDE4] text-[#1F2421] text-[10px] font-sans border border-[#E0D9CE] transition-colors"
                    >
                      {copiedOrigin ? (
                        <>
                          <Check className="w-3 h-3 text-[#2E5658]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#5C6460]" />
                          <span>Copy URL</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#78716C]">
                    To enable Google Sign-In, add this URL to{' '}
                    <strong className="text-[#1F2421]">Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</strong>{' '}
                    and under your Google Cloud API key website restrictions.
                  </p>
                </div>
              )}

              <button
                type="button"
                id="btn-error-demo-bypass"
                onClick={handleDemoSignIn}
                className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#2E5658] text-white font-medium text-xs hover:bg-[#244547] transition-colors shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Continue Instantly with Demo Mode</span>
              </button>
            </div>
          )}

          {/* Primary Action: Instant Demo Access */}
          <div className="space-y-3 pt-1">
            <button
              id="btn-signin-demo"
              type="button"
              onClick={handleDemoSignIn}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-[#2E5658] hover:bg-[#244547] text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5658] focus:ring-offset-2 transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-[#F7F4EB]" />
              <span>Explore TravelPilot (Instant Access)</span>
              <ArrowRight className="w-4 h-4 text-[#F7F4EB]/80 ml-auto" />
            </button>
            <p className="text-[11px] text-[#78716C] text-center">
              No login or setup needed &bull; Kyoto &amp; Amalfi trips, AI planning, and disruption tools ready.
            </p>

            <div className="relative flex items-center justify-center py-2">
              <div className="border-t border-[#E8E2D9] w-full" />
              <span className="bg-[#FFFFFF] px-3 text-[11px] text-[#78716C] font-medium uppercase tracking-wider absolute">
                or sign in with Google
              </span>
            </div>

            {/* Secondary Action: Continue with Google */}
            <button
              id="btn-signin-google"
              type="button"
              disabled={isSigningIn}
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl border border-[#D3E2E0] bg-[#FAF8F5] text-[#1F2421] font-medium text-sm hover:bg-[#F2EDE4] hover:border-[#B5CDC9] focus:outline-none focus:ring-2 focus:ring-[#2E5658] focus:ring-offset-2 transition-all shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSigningIn ? (
                <div className="w-5 h-5 border-2 border-[#2E5658] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              )}
              <span>{isSigningIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
              {!isSigningIn && <ArrowRight className="w-4 h-4 text-[#78716C] ml-auto" />}
            </button>
            <p className="text-[10px] text-[#78716C] text-center">
              Requires this preview origin to be in your Firebase / Google Cloud authorized domains.
            </p>
          </div>

          <div className="pt-2 text-xs text-[#78716C]">
            Secured by Firebase Authentication &amp; Firestore Security Rules
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full text-center text-xs text-[#78716C]">
        TravelPilot &mdash; Intelligent travel planning and disruption management
      </footer>
    </div>
  );
};

import React, { useState } from 'react';
import { Compass, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const SignInView: React.FC = () => {
  const { signInWithGoogle, error, clearError } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

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
        <Badge variant="neutral">Part 2 &mdash; Auth</Badge>
      </header>

      {/* Main Sign-In Hero Centerpiece */}
      <main className="max-w-md w-full mx-auto my-auto py-12">
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
            Sign in to access your personal trip workspace, monitor schedule changes, and re-plan itineraries.
          </p>

          {/* Error Message if any */}
          {error && (
            <div
              id="signin-error-banner"
              className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FAF2EF] border border-[#F3D5C8] text-[#CF8A70] text-xs text-left"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Authentication issue</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Primary Action: Continue with Google */}
          <div className="pt-2">
            <button
              id="btn-signin-google"
              type="button"
              disabled={isSigningIn}
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl border border-[#E8E2D9] bg-white text-[#1F2421] font-medium text-sm hover:bg-[#FAF8F5] hover:border-[#D0C7B8] focus:outline-none focus:ring-2 focus:ring-[#2E5658] focus:ring-offset-2 transition-all shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
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

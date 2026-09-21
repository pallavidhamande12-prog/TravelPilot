import React, { useState } from 'react';
import { Header, NavViewId } from './Header';
import { useAuth } from '../../context/AuthContext';
import { Sparkles, Copy, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

export interface AppLayoutProps {
  children: React.ReactNode;
  currentView?: NavViewId;
  onNavigate?: (view: NavViewId) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  currentView,
  onNavigate,
}) => {
  const { authNotice, clearAuthNotice, isDemoUser } = useAuth();
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [showWhitelistGuide, setShowWhitelistGuide] = useState(false);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCopyOrigin = () => {
    if (currentOrigin) {
      navigator.clipboard.writeText(currentOrigin);
      setCopiedOrigin(true);
      setTimeout(() => setCopiedOrigin(false), 2000);
    }
  };

  return (
    <div
      id="travelpilot-app-shell"
      className="min-h-screen flex flex-col bg-[#F7F4EB] text-[#1F2421]"
    >
      {authNotice && (
        <aside
          id="auth-notice-banner"
          aria-label="Demo Mode Notice"
          className="bg-[#FAF4ED] border-b border-[#EBDCCF] text-[#1F2421] px-4 py-2.5 text-xs transition-all"
        >
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start sm:items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2E5658] shrink-0 mt-0.5 sm:mt-0" />
              <div className="text-xs">
                <span className="font-semibold text-[#2E5658]">Demo Traveler Active:</span>{' '}
                <span className="text-[#5C6460]">
                  {authNotice}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                id="btn-toggle-whitelist-guide"
                onClick={() => setShowWhitelistGuide((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2E5658] hover:underline"
              >
                <span>Whitelist Origin</span>
                {showWhitelistGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <button
                type="button"
                id="btn-copy-origin-banner"
                onClick={handleCopyOrigin}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-[#F2EDE4] text-[#1F2421] text-[10px] font-sans border border-[#E0D9CE] transition-colors"
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

              <button
                type="button"
                id="btn-dismiss-auth-notice"
                onClick={clearAuthNotice}
                className="p-1 rounded text-[#78716C] hover:text-[#1F2421] hover:bg-black/5 transition-colors"
                title="Dismiss notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {showWhitelistGuide && (
            <div className="max-w-6xl mx-auto mt-2 pt-2 border-t border-[#EBDCCF]/60 text-[11px] text-[#685F58] grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="p-2 bg-white/70 rounded border border-[#EBDCCF]">
                <strong className="text-[#1F2421]">Step 1: Firebase Authorized Domains</strong>
                <p className="mt-0.5">
                  In Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains, add{' '}
                  <code className="bg-[#FAF7F2] px-1 py-0.5 rounded text-[#2E5658] font-mono">{currentOrigin}</code>
                </p>
              </div>
              <div className="p-2 bg-white/70 rounded border border-[#EBDCCF]">
                <strong className="text-[#1F2421]">Step 2: GCP Browser API Key</strong>
                <p className="mt-0.5">
                  In Google Cloud Console &rarr; APIs &amp; Services &rarr; Credentials &rarr; Browser Key, add website restriction for{' '}
                  <code className="bg-[#FAF7F2] px-1 py-0.5 rounded text-[#2E5658] font-mono">https://*.run.app/*</code>
                </p>
              </div>
            </div>
          )}
        </aside>
      )}

      <Header currentView={currentView} onNavigate={onNavigate} />

      <main
        id="travelpilot-main-content"
        className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10"
      >
        {children}
      </main>

      <footer
        id="travelpilot-footer"
        className="border-t border-[#E8E2D9] py-8 text-xs text-[#5C6460] bg-[#FAF7F2]/60"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1F2421]">TravelPilot</span>
            <span>&mdash; Intelligent trip planning and adaptive disruption management</span>
          </div>
          <div className="flex items-center gap-4 text-[#78716C]">
            <span>External provider direct navigation</span>
            <span>&bull;</span>
            <span>Real-time adaptive repair</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

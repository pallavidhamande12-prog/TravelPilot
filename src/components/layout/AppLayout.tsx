import React from 'react';
import { Header, NavViewId } from './Header';

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
  return (
    <div
      id="travelpilot-app-shell"
      className="min-h-screen flex flex-col bg-[#F7F4EB] text-[#1F2421]"
    >
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

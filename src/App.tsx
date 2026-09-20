/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { NavViewId } from './components/layout/Header';
import { SignInView } from './components/auth/SignInView';
import { HomeDashboard } from './components/home/HomeDashboard';
import { MyTripsView } from './components/trips/MyTripsView';
import { TripDetailView } from './components/trips/TripDetailView';
import { PlanTripView } from './components/planning/PlanTripView';
import { SurpriseMeView } from './components/planning/SurpriseMeView';
import { CreateTripModal } from './components/trips/CreateTripModal';
import { Compass } from 'lucide-react';

type AppView = NavViewId;

function AuthenticatedContent() {
  const { status } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [planTripId, setPlanTripId] = useState<string | null>(null);
  const [planSessionKey, setPlanSessionKey] = useState<number>(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // 1. Loading state: Resolving Firebase auth state without flashing protected content
  if (status === 'loading') {
    return (
      <div
        id="auth-loading-screen"
        className="min-h-screen flex flex-col items-center justify-center bg-[#F7F4EB] text-[#1F2421] px-4"
      >
        <div className="w-12 h-12 rounded-2xl bg-[#2E5658] text-white flex items-center justify-center shadow-xs animate-pulse mb-4">
          <Compass className="w-6 h-6" />
        </div>
        <div className="w-5 h-5 border-2 border-[#2E5658] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-[#5C6460]">Loading TravelPilot...</p>
      </div>
    );
  }

  // 2. Unauthenticated: Show TravelPilot Sign-In experience
  if (status === 'unauthenticated') {
    return <SignInView />;
  }

  const handleOpenTrip = (tripId: string) => {
    setSelectedTripId(tripId);
    setPlanTripId(null);
    setCurrentView('trip-detail');
  };

  const handleNavigatePlan = (tripId?: string) => {
    if (tripId) {
      setPlanTripId(tripId);
    } else {
      setPlanTripId(null);
      setSelectedTripId(null);
    }
    setPlanSessionKey((prev) => prev + 1);
    setCurrentView('plan-trip');
  };

  const handleBackToTrips = () => {
    setSelectedTripId(null);
    setCurrentView('my-trips');
  };

  const handleBackFromPlan = () => {
    setPlanTripId(null);
    setSelectedTripId(null);
    setCurrentView('dashboard');
  };

  const handleNavigationChange = (view: NavViewId) => {
    if (view === 'plan-trip') {
      // Plan a Trip always starts a fresh new trip planning flow
      setPlanTripId(null);
      setSelectedTripId(null);
      setPlanSessionKey((prev) => prev + 1);
    } else if (view !== 'trip-detail') {
      setSelectedTripId(null);
    }
    setCurrentView(view);
  };

  // 3. Authenticated: Render protected TravelPilot application shell
  return (
    <AppLayout currentView={currentView} onNavigate={handleNavigationChange}>
      {currentView === 'dashboard' && (
        <HomeDashboard
          onOpenTrip={handleOpenTrip}
          onNavigatePlan={handleNavigatePlan}
          onNavigateSurprise={() => setCurrentView('surprise-me')}
          onNavigateMyTrips={() => setCurrentView('my-trips')}
        />
      )}

      {currentView === 'my-trips' && (
        <MyTripsView
          onOpenTrip={handleOpenTrip}
          onNavigatePlan={handleNavigatePlan}
          onNavigateSurprise={() => setCurrentView('surprise-me')}
        />
      )}

      {currentView === 'trip-detail' && selectedTripId && (
        <TripDetailView
          tripId={selectedTripId}
          onBack={handleBackToTrips}
          onNavigatePlan={handleNavigatePlan}
        />
      )}

      {currentView === 'plan-trip' && (
        <PlanTripView
          key={`plan-${planTripId || 'new'}-${planSessionKey}`}
          initialTripId={planTripId}
          onBack={handleBackFromPlan}
          onOpenTrip={handleOpenTrip}
          onCreateNewTrip={() => setIsCreateModalOpen(true)}
        />
      )}

      {currentView === 'surprise-me' && (
        <SurpriseMeView
          onBack={handleBackToTrips}
          onOpenTrip={handleOpenTrip}
          onCustomPlan={() => {
            setSelectedTripId(null);
            setPlanTripId(null);
            setPlanSessionKey((prev) => prev + 1);
            setCurrentView('plan-trip');
          }}
        />
      )}

      {/* Global create trip modal if opened from planning view */}
      <CreateTripModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTripCreated={(newId) => {
          setIsCreateModalOpen(false);
          handleNavigatePlan(newId);
        }}
      />
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedContent />
    </AuthProvider>
  );
}

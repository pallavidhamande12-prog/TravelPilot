import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Sparkles,
  ArrowRight,
  Luggage,
  Clock,
  TrendingUp,
  Compass,
} from 'lucide-react';
import { UserTrip } from '../../types';
import { getUserTrips } from '../../lib/tripService';
import { useAuth } from '../../context/AuthContext';

interface HomeDashboardProps {
  onOpenTrip: (tripId: string) => void;
  onNavigatePlan: (tripId?: string) => void;
  onNavigateSurprise: () => void;
  onNavigateMyTrips: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onNavigatePlan,
  onNavigateSurprise,
}) => {
  const { user, profile } = useAuth();
  const [trips, setTrips] = useState<UserTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const displayName = profile?.displayName || user?.displayName || 'Traveler';
  const firstName = displayName.split(' ')[0];

  useEffect(() => {
    let isMounted = true;
    async function loadTrips() {
      if (!user) return;
      try {
        setLoading(true);
        const userTrips = await getUserTrips(user.uid);
        if (isMounted) {
          setTrips(userTrips);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load trips on dashboard:', err);
        if (isMounted) setLoading(false);
      }
    }
    loadTrips();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Derive trip metrics
  const now = new Date();
  const totalTrips = trips.length;
  const activeTrips = trips.filter((t) => t.status === 'Active');
  const upcomingTrips = trips.filter(
    (t) => t.status !== 'Completed' && (!t.endDate || new Date(t.startDate) >= now || t.status === 'Planning')
  );
  const completedTrips = trips.filter(
    (t) => t.status === 'Completed' || (t.endDate && new Date(t.endDate) < now)
  );

  return (
    <div id="dashboard-home-view" className="space-y-10 animate-in fade-in duration-150 max-w-5xl mx-auto">
      {/* 1. Welcome / Greeting & Introduction */}
      <section id="dashboard-greeting-hero" className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#EEF4F3] text-[#2E5658] border border-[#D3E2E0]">
          <Compass className="w-3.5 h-3.5 text-[#2E5658]" />
          <span>TravelPilot</span>
        </div>
        <h1
          id="dashboard-user-greeting"
          className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1F2421]"
        >
          Welcome back, {firstName}
        </h1>
        <p className="text-base sm:text-lg text-[#5C6460] leading-relaxed max-w-2xl">
          TravelPilot helps you plan personalized trips and adapt your itinerary when plans change.
        </p>
      </section>

      {/* 2. Primary Actions: Plan a Trip & Surprise Me */}
      <section id="dashboard-primary-actions" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Action 1: Plan a Trip */}
        <button
          type="button"
          id="hero-action-plan-trip"
          onClick={() => onNavigatePlan()}
          className="group text-left p-7 sm:p-8 rounded-2xl bg-white border border-[#E8E2D9] hover:border-[#2E5658] hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer relative overflow-hidden"
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center group-hover:scale-105 transition-transform">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-[#1F2421] group-hover:text-[#2E5658] transition-colors">
                  Plan a Trip
                </h3>
                <span className="text-[11px] font-semibold text-[#2E5658] bg-[#EEF4F3] px-2 py-0.5 rounded-full border border-[#D3E2E0]">
                  Custom
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#5C6460] leading-relaxed">
                Design a custom day-by-day itinerary tailored to your pace, daily budget, travel style, and accommodation.
              </p>
            </div>
          </div>

          <div className="pt-6 flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#2E5658] group-hover:translate-x-1 transition-transform">
            <span>Start Planning Itinerary</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* Action 2: Surprise Me */}
        <button
          type="button"
          id="hero-action-surprise-me"
          onClick={onNavigateSurprise}
          className="group text-left p-7 sm:p-8 rounded-2xl bg-white border border-[#E8E2D9] hover:border-[#CF8A70] hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer relative overflow-hidden"
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF2EF] text-[#CF8A70] flex items-center justify-center group-hover:scale-105 transition-transform">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-[#1F2421] group-hover:text-[#CF8A70] transition-colors">
                  Surprise Me
                </h3>
                <span className="text-[11px] font-semibold text-[#CF8A70] bg-[#FAF2EF] px-2 py-0.5 rounded-full border border-[#F2DDD5]">
                  Spontaneous
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#5C6460] leading-relaxed">
                Uncover local road trips and day getaways nearby, or discover curated destination suggestions based on your departure hub.
              </p>
            </div>
          </div>

          <div className="pt-6 flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#CF8A70] group-hover:translate-x-1 transition-transform">
            <span>Discover Destinations</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      </section>

      {/* 3. Overview Statistics: Total Trips, Upcoming, Active, Completed */}
      <section id="dashboard-quick-stats" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div id="stat-total-trips" className="p-5 rounded-2xl bg-white border border-[#E8E2D9] shadow-2xs space-y-1">
          <span className="text-xs font-medium text-[#5C6460] flex items-center gap-1.5">
            <Luggage className="w-3.5 h-3.5 text-[#2E5658]" />
            Total Trips
          </span>
          <p className="text-2xl font-bold text-[#1F2421]">
            {loading ? '—' : totalTrips}
          </p>
          <span className="text-[11px] text-[#78716C] block">In your account</span>
        </div>

        <div id="stat-upcoming-trips" className="p-5 rounded-2xl bg-white border border-[#E8E2D9] shadow-2xs space-y-1">
          <span className="text-xs font-medium text-[#5C6460] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#47716E]" />
            Upcoming
          </span>
          <p className="text-2xl font-bold text-[#2E5658]">
            {loading ? '—' : upcomingTrips.length}
          </p>
          <span className="text-[11px] text-[#78716C] block">Planned adventures</span>
        </div>

        <div id="stat-active-trips" className="p-5 rounded-2xl bg-white border border-[#E8E2D9] shadow-2xs space-y-1">
          <span className="text-xs font-medium text-[#5C6460] flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            Active
          </span>
          <p className="text-2xl font-bold text-emerald-700">
            {loading ? '—' : activeTrips.length}
          </p>
          <span className="text-[11px] text-[#78716C] block">Currently on journey</span>
        </div>

        <div id="stat-completed-trips" className="p-5 rounded-2xl bg-white border border-[#E8E2D9] shadow-2xs space-y-1">
          <span className="text-xs font-medium text-[#5C6460] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#CF8A70]" />
            Completed
          </span>
          <p className="text-2xl font-bold text-[#1F2421]">
            {loading ? '—' : completedTrips.length}
          </p>
          <span className="text-[11px] text-[#78716C] block">Past travels</span>
        </div>
      </section>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Shield,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Clock,
  Sparkles,
  Sliders,
  Pencil,
  Trash2,
  X,
  Loader2,
  Building2,
  Plane,
  Train,
  Bus,
  Car,
  Navigation,
  Wallet,
  CheckCircle2,
  Compass,
} from 'lucide-react';
import { Trip, TripMember, TripMemberRole, TripItinerary } from '../../types';
import { getTripDetails, updateTripName, deleteTrip, updateDailyActualExpense } from '../../lib/tripService';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { openGoogleMapsSearch } from '../../utils/externalLinks';
import { StaySection } from '../stay/StaySection';
import { ItineraryView } from '../itinerary/ItineraryView';
import { calculateTripProgress } from '../../utils/tripProgress';

interface TripDetailViewProps {
  tripId: string;
  onBack: () => void;
  onNavigatePlan?: (tripId: string) => void;
}

type TripDetailTab = 'overview' | 'itinerary' | 'stay' | 'transport' | 'budget' | 'members';

function formatDateRange(startDateStr: string, endDateStr: string): string {
  try {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${start.toLocaleDateString(undefined, options)} – ${end.toLocaleDateString(undefined, options)}`;
  } catch {
    return `${startDateStr} – ${endDateStr}`;
  }
}

function getInitials(name: string): string {
  if (!name) return 'TP';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getTransportIcon(mode: string) {
  switch (mode) {
    case 'flight':
      return <Plane className="w-5 h-5 text-sky-700" />;
    case 'train':
      return <Train className="w-5 h-5 text-indigo-700" />;
    case 'bus':
      return <Bus className="w-5 h-5 text-amber-700" />;
    case 'road':
      return <Car className="w-5 h-5 text-emerald-700" />;
    default:
      return <Navigation className="w-5 h-5 text-[#5C6460]" />;
  }
}

export const TripDetailView: React.FC<TripDetailViewProps> = ({ tripId, onBack, onNavigatePlan }) => {
  const { user, profile } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [userRole, setUserRole] = useState<TripMemberRole | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<TripDetailTab>('overview');

  // Edit Trip Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [editNameError, setEditNameError] = useState<string | null>(null);

  // Delete Trip State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingTrip, setIsDeletingTrip] = useState(false);
  const [deleteTripError, setDeleteTripError] = useState<string | null>(null);

  // Budget Tracking State
  const [dailyExpenseInputs, setDailyExpenseInputs] = useState<Record<number, string>>({});
  const [savingExpenseDay, setSavingExpenseDay] = useState<number | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expenseSuccessDay, setExpenseSuccessDay] = useState<number | null>(null);

  const canEditTrip = Boolean(
    trip &&
      (userRole === 'admin' ||
        userRole === 'co-admin' ||
        trip.adminId === user?.uid ||
        trip.coAdminId === user?.uid)
  );
  const canDeleteTrip = Boolean(trip && (userRole === 'admin' || trip.adminId === user?.uid));

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!user) return;
      try {
        setLoading(true);
        setError(null);
        const data = await getTripDetails(tripId, user.uid);
        if (isMounted) {
          setTrip(data.trip);
          setUserRole(data.userRole);
          setMembers(data.members);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load trip details.');
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [tripId, user]);

  const handleCopyCode = async () => {
    if (!trip?.joinCode) return;
    try {
      await navigator.clipboard.writeText(trip.joinCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleOpenEditName = () => {
    if (!trip) return;
    setEditNameValue(trip.name);
    setEditNameError(null);
    setIsEditingName(true);
  };

  const handleSaveName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!trip || !user) return;
    const trimmed = editNameValue.trim();
    if (!trimmed) {
      setEditNameError('Trip name cannot be empty.');
      return;
    }
    try {
      setIsSavingName(true);
      setEditNameError(null);
      const updated = await updateTripName(trip.id, trimmed, user.uid);
      setTrip((prev) => (prev ? { ...prev, name: updated.name } : null));
      setIsEditingName(false);
    } catch (err: unknown) {
      setEditNameError(err instanceof Error ? err.message : 'Unable to update trip name.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!trip || !user) return;
    try {
      setIsDeletingTrip(true);
      setDeleteTripError(null);
      await deleteTrip(trip.id, user.uid);
      setIsDeleteDialogOpen(false);
      onBack();
    } catch (err: unknown) {
      setDeleteTripError(err instanceof Error ? err.message : 'Unable to delete trip.');
      setIsDeletingTrip(false);
    }
  };

  const handleSaveDailyExpense = async (dayNumber: number) => {
    if (!trip || !user) return;
    const rawVal = dailyExpenseInputs[dayNumber];
    const amount = Number(rawVal);
    if (isNaN(amount) || amount < 0) {
      setExpenseError(`Please enter a valid positive number for Day ${dayNumber}.`);
      return;
    }

    try {
      setSavingExpenseDay(dayNumber);
      setExpenseError(null);
      const updated = await updateDailyActualExpense(trip.id, dayNumber, amount, user.uid);
      setTrip(updated);
      setExpenseSuccessDay(dayNumber);
      setTimeout(() => {
        setExpenseSuccessDay(null);
      }, 2500);
    } catch (err: unknown) {
      setExpenseError(err instanceof Error ? err.message : 'Failed to save actual expenditure.');
    } finally {
      setSavingExpenseDay(null);
    }
  };

  if (loading) {
    return (
      <div id="trip-detail-loading" className="py-20 flex flex-col items-center justify-center space-y-3">
        <div className="w-6 h-6 border-2 border-[#2E5658] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-[#5C6460]">Loading trip details...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div id="trip-detail-error" className="max-w-xl mx-auto py-12 space-y-4">
        <Card variant="subtle" className="p-6 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#FAF2EF] text-[#CF8A70] flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1F2421]">Trip Unavailable</h2>
            <p className="text-xs text-[#5C6460] mt-1">
              {error || 'Trip could not be found or you do not have permission to view it.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onBack} icon={<ArrowLeft className="w-3.5 h-3.5" />}>
            Back to My Trips
          </Button>
        </Card>
      </div>
    );
  }

  // Calculate progress if itinerary is available
  const progress = trip.itinerary ? calculateTripProgress(trip.itinerary) : null;

  // Tabs configuration
  const tabs: Array<{ id: TripDetailTab; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'itinerary', label: 'Itinerary', count: trip.itinerary?.days?.length },
    { id: 'stay', label: 'Stay' },
    { id: 'transport', label: 'Getting There' },
    { id: 'budget', label: 'Budget' },
    { id: 'members', label: 'Members', count: members.length },
  ];

  return (
    <div id="trip-detail-page" className="space-y-8 animate-in fade-in duration-150">
      {/* 1. Back Navigation & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button
          id="btn-back-to-trips"
          variant="outline"
          size="sm"
          onClick={onBack}
          icon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          Back to My Trips
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigatePlan && (
            <Button
              id="btn-detail-plan-trip"
              variant="primary"
              size="sm"
              onClick={() => onNavigatePlan(trip.id)}
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              {trip.itinerary ? 'Edit Plan Preferences' : 'Plan Trip Itinerary'}
            </Button>
          )}
          <Badge variant="teal" icon={<Shield className="w-3 h-3" />} className="capitalize">
            {userRole}
          </Badge>
          <Badge variant="neutral">{trip.status}</Badge>
        </div>
      </div>

      {/* 2. Top Trip Header Summary Card */}
      <div
        id="trip-header-summary-card"
        className="p-6 sm:p-8 rounded-2xl bg-white border border-[#E8E2D9] shadow-xs space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#2E5658]">
                {trip.tripType} Trip
              </span>
              <span className="text-[#A8A29E]">&bull;</span>
              <span className="text-xs text-[#5C6460]">{formatDateRange(trip.startDate, trip.endDate)}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 id="trip-detail-title" className="text-2xl sm:text-3xl font-bold text-[#1F2421]">
                {trip.name}
              </h1>
              {canEditTrip && (
                <button
                  type="button"
                  id="btn-edit-trip-name"
                  onClick={handleOpenEditName}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#2E5658] bg-[#EEF4F3] hover:bg-[#D3E2E0] rounded-full transition cursor-pointer"
                  title="Edit Trip Name"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit Name</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-[#5C6460]">
              <MapPin className="w-4 h-4 text-[#2E5658] shrink-0" />
              <span>{trip.destination}</span>
              <button
                onClick={() => openGoogleMapsSearch(trip.destination)}
                className="inline-flex items-center gap-1 text-xs text-[#2E5658] hover:underline ml-2 font-medium"
              >
                <span>View on Maps</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Join Code Box */}
          <div
            id="trip-join-code-box"
            className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8E2D9] space-y-1.5 min-w-[200px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5C6460]">
                Trip Join Code
              </span>
              <span className="text-[10px] text-[#78716C]">Invite members</span>
            </div>
            <div className="flex items-center justify-between gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#E8E2D9]">
              <span className="font-mono text-base font-semibold tracking-wider text-[#2E5658]">
                {trip.joinCode}
              </span>
              <button
                id="btn-copy-join-code"
                onClick={handleCopyCode}
                className="text-[#5C6460] hover:text-[#2E5658] p-1 rounded-md transition-colors"
                title="Copy code"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {copiedCode && (
              <p className="text-[10px] text-emerald-700 font-medium">Copied to clipboard!</p>
            )}
          </div>
        </div>

        {/* Core Attributes Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-[#E8E2D9] text-xs">
          <div className="space-y-1">
            <span className="text-[#5C6460] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#2E5658]" />
              Dates
            </span>
            <p className="text-sm font-semibold text-[#1F2421]">{trip.startDate} to {trip.endDate}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[#5C6460] flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-[#2E5658]" />
              Daily Budget
            </span>
            <p className="text-sm font-semibold text-[#1F2421]">₹{trip.dailyBudget.toLocaleString('en-IN')} / day</p>
          </div>
          <div className="space-y-1">
            <span className="text-[#5C6460] flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#2E5658]" />
              Trip Type
            </span>
            <p className="text-sm font-semibold text-[#1F2421]">{trip.tripType}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[#5C6460] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#2E5658]" />
              Status
            </span>
            <p className="text-sm font-semibold text-[#1F2421]">{trip.status}</p>
          </div>
        </div>

        {/* Progress Bar (if itinerary exists) */}
        {progress && (
          <div className="pt-4 border-t border-[#E8E2D9] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#1F2421]">
                Trip Activity Progress ({progress.completedActivities} of {progress.totalActivities} completed)
              </span>
              <span className="font-bold text-[#2E5658]">{progress.percent}%</span>
            </div>
            <div className="w-full bg-[#FAF7F2] rounded-full h-2 overflow-hidden border border-[#E8E2D9]">
              <div
                className="bg-[#2E5658] h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Internal Navigation Tabs */}
      <div className="border-b border-[#E8E2D9] overflow-x-auto">
        <div className="flex items-center gap-2 py-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`trip-tab-${tab.id}`}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#EEF4F3] text-[#2E5658] border border-[#D3E2E0] shadow-2xs'
                    : 'text-[#5C6460] hover:text-[#1F2421] hover:bg-white/60'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                      isActive ? 'bg-[#2E5658] text-white' : 'bg-[#FAF7F2] text-[#5C6460]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Tab Content Panels */}
      <div id="trip-tab-content-container">
        {/* Tab 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Itinerary Snapshot */}
            {trip.itinerary ? (
              <Card variant="surface" className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E8E2D9]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1F2421]">
                        Day-by-Day AI Itinerary
                      </h3>
                      <p className="text-xs text-[#5C6460]">
                        {trip.itinerary.days.length} days planned with {trip.itinerary.days.reduce((acc, d) => acc + (d.activities?.length || 0), 0)} curated stops
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setActiveTab('itinerary')}
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                  >
                    Open Full Itinerary
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl space-y-1">
                    <span className="text-[#5C6460]">Days</span>
                    <p className="font-bold text-[#1F2421]">{trip.itinerary.days.length} Days</p>
                  </div>
                  <div className="p-3 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl space-y-1">
                    <span className="text-[#5C6460]">Total Cost Est.</span>
                    <p className="font-bold text-[#1F2421]">₹{trip.itinerary.totalEstimatedCost.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="p-3 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl space-y-1">
                    <span className="text-[#5C6460]">Daily Budget</span>
                    <p className="font-bold text-[#1F2421]">₹{trip.itinerary.dailyBudget.toLocaleString('en-IN')}/day</p>
                  </div>
                  <div className="p-3 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl space-y-1">
                    <span className="text-[#5C6460]">Travel Style</span>
                    <p className="font-bold text-[#1F2421]">{trip.itinerary.planningSnapshot?.travelStyle || 'Balanced'}</p>
                  </div>
                </div>
              </Card>
            ) : trip.planning ? (
              <Card variant="surface" className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E8E2D9]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-[#CF8A70]" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1F2421]">
                        Preferences Stored
                      </h3>
                      <p className="text-xs text-[#5C6460]">
                        Target destination: {trip.planning.destination} &bull; {trip.planning.travelers} Travelers
                      </p>
                    </div>
                  </div>

                  {onNavigatePlan && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onNavigatePlan(trip.id)}
                      icon={<Sparkles className="w-3.5 h-3.5" />}
                    >
                      Generate Itinerary
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl">
                    <span className="text-[#5C6460] block">Pace</span>
                    <span className="font-bold text-[#1F2421]">{trip.planning.travelStyle} Pace</span>
                  </div>
                  <div className="p-3 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl">
                    <span className="text-[#5C6460] block">Target Focus</span>
                    <span className="font-bold text-[#1F2421]">{trip.planning.destination}</span>
                  </div>
                  <div className="p-3 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl">
                    <span className="text-[#5C6460] block">Daily Budget</span>
                    <span className="font-bold text-[#1F2421]">₹{trip.planning.dailyBudget.toLocaleString('en-IN')}/day</span>
                  </div>
                </div>
              </Card>
            ) : (
              <Card variant="surface" className="p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2] text-[#2E5658] flex items-center justify-center mx-auto">
                  <Compass className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#1F2421]">Ready to plan your itinerary?</h3>
                  <p className="text-xs text-[#5C6460]">
                    Select your travel pace, daily budget, and themes to generate an adaptive day-by-day plan.
                  </p>
                </div>
                {onNavigatePlan && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onNavigatePlan(trip.id)}
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                  >
                    Plan Trip Preferences
                  </Button>
                )}
              </Card>
            )}

            {/* Stay Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card variant="surface" className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#2E5658]" />
                    <h3 className="text-sm font-bold text-[#1F2421]">Accommodation</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('stay')}
                    className="text-xs font-semibold text-[#2E5658] hover:underline"
                  >
                    Manage Stay &rarr;
                  </button>
                </div>
                {trip.stay && trip.stay.mode === 'existing' ? (
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-[#1F2421] text-sm">{trip.stay.name}</p>
                    <p className="text-[#5C6460]">{trip.stay.address || trip.destination}</p>
                    <p className="text-[#78716C]">{trip.stay.checkInDate} to {trip.stay.checkOutDate}</p>
                  </div>
                ) : trip.stay && trip.stay.mode === 'help_me_find' ? (
                  <p className="text-xs text-[#5C6460]">
                    AI Neighborhood Guidance requested for this trip.
                  </p>
                ) : (
                  <p className="text-xs text-[#5C6460]">
                    No hotel or stay details saved yet. Add your accommodation to optimize activity transit.
                  </p>
                )}
              </Card>

              {/* Members Preview */}
              <Card variant="surface" className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#2E5658]" />
                    <h3 className="text-sm font-bold text-[#1F2421]">Trip Collaborators</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('members')}
                    className="text-xs font-semibold text-[#2E5658] hover:underline"
                  >
                    View All ({members.length}) &rarr;
                  </button>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {members.slice(0, 5).map((m) => {
                    const isMe = m.uid === user?.uid;
                    const rawName = isMe ? (profile?.displayName || m.displayName) : m.displayName;
                    const displayName = rawName?.trim() || 'Member';
                    return (
                      <div
                        key={m.uid}
                        className="w-8 h-8 rounded-full bg-[#EEF4F3] border border-[#D3E2E0] text-[#2E5658] flex items-center justify-center text-xs font-bold shrink-0"
                        title={`${displayName} (${m.role})`}
                      >
                        {getInitials(displayName)}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Tab 2: ITINERARY */}
        {activeTab === 'itinerary' && (
          <div className="space-y-6">
            {trip.itinerary ? (
              <ItineraryView
                trip={trip}
                itinerary={trip.itinerary}
                userRole={userRole || 'member'}
                onEditPreferences={() => onNavigatePlan?.(trip.id)}
                onBackToOverview={() => setActiveTab('overview')}
                onUpdateItinerary={(updated) =>
                  setTrip((prev) => (prev ? { ...prev, itinerary: updated } : null))
                }
                onUpdateTripName={(name) =>
                  setTrip((prev) => (prev ? { ...prev, name } : null))
                }
              />
            ) : (
              <Card variant="surface" className="p-10 text-center space-y-4 max-w-lg mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-[#1F2421]">No Itinerary Generated Yet</h3>
                  <p className="text-xs text-[#5C6460]">
                    Configure your pacing and daily budget to generate a custom day-by-day itinerary.
                  </p>
                </div>
                {onNavigatePlan && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => onNavigatePlan(trip.id)}
                    icon={<Sparkles className="w-4 h-4" />}
                  >
                    Plan Itinerary Now
                  </Button>
                )}
              </Card>
            )}
          </div>
        )}

        {/* Tab 3: STAY */}
        {activeTab === 'stay' && (
          <div className="space-y-6">
            <StaySection
              trip={trip}
              canEdit={canEditTrip}
              onTripUpdated={(updatedTrip) => setTrip(updatedTrip)}
            />
          </div>
        )}

        {/* Tab 4: GETTING THERE */}
        {activeTab === 'transport' && (
          <div className="space-y-6">
            {trip.itinerary?.transportation?.options &&
            trip.itinerary.transportation.options.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-[#1F2421]">Transit & Travel Routes</h2>
                  <p className="text-xs text-[#5C6460]">
                    Validated travel options between your origin and {trip.destination}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trip.itinerary.transportation.options.map((opt, idx) => (
                    <Card key={idx} variant="surface" className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9]">
                            {getTransportIcon(opt.mode)}
                          </div>
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-[#2E5658]">
                              {opt.mode}
                            </span>
                            <h4 className="text-sm font-bold text-[#1F2421]">{opt.title}</h4>
                          </div>
                        </div>

                        <span className="text-xs font-bold text-[#1F2421] bg-[#FAF7F2] px-2.5 py-1 rounded-full border border-[#E8E2D9]">
                          {opt.costEstimate}
                        </span>
                      </div>

                      <div className="text-xs text-[#5C6460] space-y-1 pt-2 border-t border-[#E8E2D9]">
                        <p><span className="font-semibold text-[#1F2421]">Duration:</span> {opt.estimatedDuration}</p>
                        <p>{opt.description}</p>
                        {opt.notes && (
                          <p className="text-[#78716C] italic pt-1">{opt.notes}</p>
                        )}
                      </div>

                      {opt.actionUrl && (
                        <a
                          href={opt.actionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E5658] hover:underline pt-1"
                        >
                          <span>{opt.actionLabel || 'Search Option'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <Card variant="surface" className="p-8 text-center space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2] text-[#2E5658] flex items-center justify-center mx-auto">
                  <Plane className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#1F2421]">Transit recommendations not generated yet</h3>
                  <p className="text-xs text-[#5C6460]">
                    Generate or update your trip itinerary to receive travel route recommendations.
                  </p>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Tab 5: BUDGET */}
        {activeTab === 'budget' && (() => {
          // Total days in trip
          const tripDaysCount = trip.itinerary?.days?.length || (() => {
            try {
              const start = new Date(trip.startDate);
              const end = new Date(trip.endDate);
              const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              return Math.max(diff, 1);
            } catch {
              return 1;
            }
          })();

          // Total Trip Target Budget = dailyBudget * totalDays
          const totalTripBudget = (trip.dailyBudget || 0) * tripDaysCount;

          // Estimated Activities Cost from itinerary
          const totalEstimatedCost = trip.itinerary ? trip.itinerary.totalEstimatedCost : 0;

          // Actual Daily Expenses Map: { [dayNumber]: number }
          const actualExpensesMap = trip.actualDailyExpenses || {};

          // Calculate Total Actual Spent
          const totalActualSpent = Object.values(actualExpensesMap).reduce(
            (sum, val) => sum + (Number(val) || 0),
            0
          );

          // Days with recorded expenses
          const daysWithExpenses = Object.keys(actualExpensesMap).filter(
            (k) => Number(actualExpensesMap[Number(k)]) > 0
          ).length;

          // Remaining Budget
          const remainingBudget = totalTripBudget - totalActualSpent;

          // Remaining Days without recorded expenses
          const remainingDaysCount = Math.max(tripDaysCount - daysWithExpenses, 0);

          // Suggested daily budget for remaining days
          const suggestedRemainingDailyBudget =
            remainingDaysCount > 0
              ? Math.max(Math.round(remainingBudget / remainingDaysCount), 0)
              : 0;

          // Array of day numbers: 1 .. tripDaysCount
          const dayNumbers = Array.from({ length: tripDaysCount }, (_, i) => i + 1);

          return (
            <div id="trip-budget-tracking-section" className="space-y-8">
              {/* 1. Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card variant="surface" className="p-5 space-y-1">
                  <span className="text-xs text-[#5C6460]">Total Planned Budget</span>
                  <p className="text-2xl font-bold text-[#1F2421]">
                    ₹{totalTripBudget.toLocaleString('en-IN')}
                  </p>
                  <span className="text-[11px] text-[#78716C]">
                    ₹{trip.dailyBudget.toLocaleString('en-IN')}/day × {tripDaysCount} days
                  </span>
                </Card>

                <Card variant="surface" className="p-5 space-y-1">
                  <span className="text-xs text-[#5C6460]">Estimated Activities Cost</span>
                  <p className="text-2xl font-bold text-[#2E5658]">
                    {trip.itinerary ? `₹${totalEstimatedCost.toLocaleString('en-IN')}` : '—'}
                  </p>
                  <span className="text-[11px] text-[#78716C]">
                    {trip.itinerary
                      ? `${trip.itinerary.days.reduce((acc, d) => acc + (d.activities?.length || 0), 0)} stops planned`
                      : 'Plan not generated'}
                  </span>
                </Card>

                <Card variant="surface" className="p-5 space-y-1">
                  <span className="text-xs text-[#5C6460]">Total Actual Expenditure</span>
                  <p className={`text-2xl font-bold ${totalActualSpent > totalTripBudget ? 'text-red-600' : 'text-[#1F2421]'}`}>
                    ₹{totalActualSpent.toLocaleString('en-IN')}
                  </p>
                  <span className="text-[11px] text-[#78716C]">
                    {daysWithExpenses} of {tripDaysCount} days logged
                  </span>
                </Card>

                <Card
                  variant="surface"
                  className={`p-5 space-y-1 ${remainingBudget < 0 ? 'border-red-200 bg-red-50/20' : ''}`}
                >
                  <span className="text-xs text-[#5C6460]">Remaining Budget</span>
                  <p className={`text-2xl font-bold ${remainingBudget < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    ₹{remainingBudget.toLocaleString('en-IN')}
                  </p>
                  <span className="text-[11px] text-[#78716C]">
                    {remainingDaysCount > 0
                      ? `Suggested ~₹${suggestedRemainingDailyBudget.toLocaleString('en-IN')}/day remaining`
                      : 'All days accounted for'}
                  </span>
                </Card>
              </div>

              {/* 2. Budget Health Progress Bar */}
              <Card variant="surface" className="p-6 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#1F2421]">Overall Budget Utilization</span>
                  <span className="text-[#5C6460]">
                    {totalTripBudget > 0 ? Math.min(Math.round((totalActualSpent / totalTripBudget) * 100), 999) : 0}% used
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#E8E2D9] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      totalActualSpent > totalTripBudget
                        ? 'bg-red-500'
                        : totalActualSpent > totalTripBudget * 0.85
                        ? 'bg-amber-500'
                        : 'bg-[#2E5658]'
                    }`}
                    style={{
                      width: `${totalTripBudget > 0 ? Math.min((totalActualSpent / totalTripBudget) * 100, 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#78716C]">
                  <span>₹0</span>
                  <span>Target: ₹{totalTripBudget.toLocaleString('en-IN')}</span>
                </div>
              </Card>

              {/* 3. Day-by-Day Actual Expenditure Logger */}
              <Card variant="surface" className="p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8E2D9] pb-4">
                  <div>
                    <h3 className="text-base font-bold text-[#1F2421]">Day-by-Day Expenditure Tracker</h3>
                    <p className="text-xs text-[#5C6460] mt-0.5">
                      Log actual daily expenses. Values persist securely in your trip record.
                    </p>
                  </div>
                  {daysWithExpenses > 0 && (
                    <span className="text-xs font-medium text-[#2E5658] bg-[#EEF4F3] px-2.5 py-1 rounded-full border border-[#D3E2E0] self-start sm:self-auto">
                      {daysWithExpenses} / {tripDaysCount} days entered
                    </span>
                  )}
                </div>

                {expenseError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between">
                    <span>{expenseError}</span>
                    <button
                      type="button"
                      onClick={() => setExpenseError(null)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="divide-y divide-[#E8E2D9]">
                  {dayNumbers.map((dayNum) => {
                    // Itinerary day details if available
                    const itineraryDay = trip.itinerary?.days?.find((d) => d.dayNumber === dayNum);
                    const dayEstimatedCost = itineraryDay?.estimatedDailyCost || trip.dailyBudget || 0;
                    const savedActual = actualExpensesMap[dayNum] !== undefined ? actualExpensesMap[dayNum] : null;
                    const currentInput = dailyExpenseInputs[dayNum] !== undefined
                      ? dailyExpenseInputs[dayNum]
                      : (savedActual !== null ? String(savedActual) : '');
                    const isSavingThisDay = savingExpenseDay === dayNum;
                    const isJustSaved = expenseSuccessDay === dayNum;

                    // Variance calculation
                    const actualNum = savedActual !== null ? Number(savedActual) : null;
                    const variance = actualNum !== null ? actualNum - dayEstimatedCost : null;

                    return (
                      <div
                        key={dayNum}
                        id={`budget-day-row-${dayNum}`}
                        className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0"
                      >
                        {/* Day Info */}
                        <div className="space-y-1 min-w-[180px]">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#1F2421] bg-[#FAF7F2] border border-[#E8E2D9] px-2.5 py-0.5 rounded-md">
                              Day {dayNum}
                            </span>
                            {itineraryDay?.date && (
                              <span className="text-xs font-medium text-[#5C6460]">
                                {itineraryDay.date}
                              </span>
                            )}
                            {itineraryDay?.activities && itineraryDay.activities.length > 0 && (
                              <span className="text-xs text-[#78716C] truncate max-w-[200px]">
                                &bull; {itineraryDay.activities[0].name}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#78716C] flex items-center gap-2">
                            <span>Estimated: ₹{dayEstimatedCost.toLocaleString('en-IN')}</span>
                            {variance !== null && (
                              <span
                                className={`font-semibold ${
                                  variance > 0
                                    ? 'text-red-600'
                                    : variance < 0
                                    ? 'text-emerald-700'
                                    : 'text-[#78716C]'
                                }`}
                              >
                                ({variance > 0 ? `+₹${variance.toLocaleString('en-IN')}` : variance < 0 ? `-₹${Math.abs(variance).toLocaleString('en-IN')}` : 'Exact'})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Input & Save Action */}
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#78716C]">
                              ₹
                            </span>
                            <input
                              id={`input-actual-expense-day-${dayNum}`}
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              value={currentInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDailyExpenseInputs((prev) => ({
                                  ...prev,
                                  [dayNum]: val,
                                }));
                              }}
                              className="w-32 sm:w-36 pl-7 pr-3 py-1.5 text-xs bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658]/30 font-medium"
                            />
                          </div>

                          <Button
                            id={`btn-save-expense-day-${dayNum}`}
                            type="button"
                            size="sm"
                            variant={isJustSaved ? 'secondary' : 'outline'}
                            onClick={() => handleSaveDailyExpense(dayNum)}
                            disabled={isSavingThisDay || currentInput === ''}
                            icon={
                              isSavingThisDay ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : isJustSaved ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : undefined
                            }
                          >
                            {isSavingThisDay ? 'Saving' : isJustSaved ? 'Saved' : 'Save'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          );
        })()}

        {/* Tab 6: MEMBERS */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            <Card variant="surface" className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#1F2421]">Trip Members</h2>
                  <p className="text-xs text-[#5C6460]">Collaborators who can view or manage this trip</p>
                </div>
                <span className="text-xs font-semibold text-[#2E5658] bg-[#EEF4F3] px-3 py-1 rounded-full">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </span>
              </div>

              <div className="divide-y divide-[#E8E2D9]">
                {members.map((m) => {
                  const isMe = m.uid === user?.uid;
                  const rawName = isMe ? (profile?.displayName || m.displayName) : m.displayName;
                  const displayName = rawName?.trim() || 'TravelPilot Member';
                  const initials = getInitials(displayName);
                  const roleLabel = m.role === 'admin' ? 'Admin' : m.role === 'co-admin' ? 'Co-admin' : 'Member';

                  return (
                    <div key={m.uid} className="py-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {m.photoURL ? (
                          <img
                            src={m.photoURL}
                            alt={displayName}
                            className="w-9 h-9 rounded-full object-cover border border-[#E8E2D9]"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#EEF4F3] border border-[#D3E2E0] text-[#2E5658] flex items-center justify-center text-xs font-bold">
                            {initials}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#1F2421]">
                              {displayName}
                            </span>
                            {isMe && (
                              <span className="text-[10px] text-[#2E5658] bg-[#EEF4F3] px-1.5 py-0.5 rounded-full font-medium">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#78716C] font-normal">
                            {roleLabel}
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant={m.role === 'admin' ? 'teal' : 'neutral'}
                        className="capitalize text-xs"
                      >
                        {m.role}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Admin Trip Management / Danger Zone */}
            {canDeleteTrip && (
              <Card id="card-trip-management" variant="surface" className="p-6 border-red-200 bg-red-50/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-red-900">Trip Management</h3>
                    <p className="text-xs text-[#5C6460]">
                      Permanently remove this trip, its itinerary, and all associated activity records. This action cannot be undone.
                    </p>
                  </div>
                  <Button
                    id="btn-open-delete-trip-modal"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDeleteTripError(null);
                      setIsDeleteDialogOpen(true);
                    }}
                    icon={<Trash2 className="w-3.5 h-3.5 text-red-600" />}
                    className="text-red-700 border-red-200 hover:bg-red-50 shrink-0"
                  >
                    Delete Trip
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Edit Trip Name Modal */}
      {isEditingName && (
        <div
          id="modal-edit-trip-name"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white border border-[#E8E2D9] rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-[#E8E2D9]">
              <div className="flex items-center gap-2 text-[#1F2421] font-bold text-lg">
                <Pencil className="w-4 h-4 text-[#2E5658]" />
                <span>Edit Trip Name</span>
              </div>
              <button
                type="button"
                id="btn-close-edit-name"
                onClick={() => setIsEditingName(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveName} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="input-edit-trip-name"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#5C6460]"
                >
                  Trip Name
                </label>
                <input
                  id="input-edit-trip-name"
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  placeholder="e.g. Summer in Tokyo"
                  className="w-full px-3.5 py-2.5 border border-[#E8E2D9] rounded-xl text-sm text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658] focus:border-transparent transition"
                  autoFocus
                  disabled={isSavingName}
                />
                <p className="text-[11px] text-[#78716C]">
                  Dates, destination, travelers, and budget remain unchanged.
                </p>
              </div>

              {editNameError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                  {editNameError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  id="btn-cancel-edit-name"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingName(false)}
                  disabled={isSavingName}
                >
                  Cancel
                </Button>
                <Button
                  id="btn-save-edit-name"
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSavingName || !editNameValue.trim()}
                  icon={
                    isSavingName ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )
                  }
                >
                  {isSavingName ? 'Saving...' : 'Save Name'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Trip Confirmation Modal */}
      {isDeleteDialogOpen && (
        <div
          id="modal-delete-trip"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white border border-[#E8E2D9] rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1F2421]">Delete this trip?</h3>
                <p className="text-xs text-[#5C6460] mt-0.5">
                  This will permanently remove the trip and its itinerary. This action cannot be undone.
                </p>
              </div>
            </div>

            {deleteTripError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {deleteTripError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                id="btn-cancel-delete-trip"
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeletingTrip}
              >
                Cancel
              </Button>
              <button
                type="button"
                id="btn-confirm-delete-trip"
                onClick={handleConfirmDelete}
                disabled={isDeletingTrip}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-semibold transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isDeletingTrip ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Trip</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  TripItinerary,
  Trip,
  TripMemberRole,
  TransportOption,
  ActivityStatus,
  ItineraryActivity,
  DisruptionReport,
  ReplanResult,
  ReplacementAlternative,
} from '../../types';
import {
  Sparkles,
  MapPin,
  Calendar,
  Wallet,
  Clock,
  ExternalLink,
  Compass,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Tag,
  Share2,
  Sliders,
  Plane,
  Train,
  Bus,
  Car,
  Navigation,
  IndianRupee,
  Info,
  AlertTriangle,
  RotateCcw,
  Check,
  ShieldCheck,
  History,
  X,
  Pencil,
  Trash2,
  Loader2,
  Building2,
} from 'lucide-react';
import { saveTripItinerary, updateTripName } from '../../lib/tripService';
import { StaySection } from '../stay/StaySection';
import {
  analyzeAndReplanDisruption,
  applyReplacementToItinerary,
  removeActivityFromItinerary,
  deleteActivityFromItinerary,
  updateActivityStatus,
} from '../../services/replanService';
import { useAuth } from '../../context/AuthContext';
import { DisruptionReportModal } from './DisruptionReportModal';
import { DisruptionReplanModal } from './DisruptionReplanModal';
import { calculateTripProgress, calculateDayProgress } from '../../utils/tripProgress';

interface ItineraryViewProps {
  trip: Trip;
  itinerary: TripItinerary;
  userRole?: TripMemberRole;
  onEditPreferences?: () => void;
  onBackToOverview?: () => void;
  onReplan?: () => void;
  isReplanning?: boolean;
  onUpdateItinerary?: (updatedItinerary: TripItinerary) => void;
  onUpdateTripName?: (newName: string) => void;
}

function getTransportIcon(mode: string) {
  switch (mode) {
    case 'flight':
      return <Plane className="w-5 h-5 text-sky-600" />;
    case 'train':
      return <Train className="w-5 h-5 text-indigo-600" />;
    case 'bus':
      return <Bus className="w-5 h-5 text-amber-600" />;
    case 'road':
      return <Car className="w-5 h-5 text-emerald-600" />;
    default:
      return <Navigation className="w-5 h-5 text-stone-600" />;
  }
}

export const ItineraryView: React.FC<ItineraryViewProps> = ({
  trip,
  itinerary: initialItinerary,
  userRole,
  onEditPreferences,
  onBackToOverview,
  onReplan,
  isReplanning = false,
  onUpdateItinerary,
  onUpdateTripName,
}) => {
  const { user } = useAuth();
  const canEdit = Boolean(
    userRole === 'admin' ||
      userRole === 'co-admin' ||
      (!userRole && (trip.adminId === user?.uid || trip.coAdminId === user?.uid))
  );

  // Local active itinerary synchronized with props and adaptive updates
  const [itinerary, setItinerary] = useState<TripItinerary>(initialItinerary);

  // Synchronized trip state
  const [currentTrip, setCurrentTrip] = useState<Trip>(trip);
  const [currentTripName, setCurrentTripName] = useState(trip.name);
  useEffect(() => {
    setCurrentTrip(trip);
    setCurrentTripName(trip.name);
  }, [trip]);

  const handleTripUpdated = (updatedTrip: Trip) => {
    setCurrentTrip(updatedTrip);
    if (updatedTrip.name !== currentTripName) {
      setCurrentTripName(updatedTrip.name);
      if (onUpdateTripName) {
        onUpdateTripName(updatedTrip.name);
      }
    }
    if (updatedTrip.itinerary) {
      setItinerary(updatedTrip.itinerary);
      if (onUpdateItinerary) {
        onUpdateItinerary(updatedTrip.itinerary);
      }
    }
  };

  // Edit Trip Name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(trip.name);
  const [isSavingName, setIsSavingName] = useState(false);
  const [editNameError, setEditNameError] = useState<string | null>(null);

  // Remove Activity confirmation state
  const [activityToRemove, setActivityToRemove] = useState<{
    dayNumber: number;
    candidateId: string;
    name: string;
  } | null>(null);
  const [isRemovingActivity, setIsRemovingActivity] = useState(false);

  useEffect(() => {
    setItinerary(initialItinerary);
  }, [initialItinerary]);

  const [selectedDayNumber, setSelectedDayNumber] = useState<number | 'all'>('all');
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});
  const [showShareNotification, setShowShareNotification] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAuditHistory, setShowAuditHistory] = useState(false);

  // Disruption and Replanning State
  const [isDisruptionModalOpen, setIsDisruptionModalOpen] = useState(false);
  const [isReplanModalOpen, setIsReplanModalOpen] = useState(false);
  const [targetActivity, setTargetActivity] = useState<{
    dayNumber: number;
    activity: ItineraryActivity;
  } | null>(null);
  const [isAnalyzingDisruption, setIsAnalyzingDisruption] = useState(false);
  const [isApplyingReplacement, setIsApplyingReplacement] = useState(false);
  const [replanResult, setReplanResult] = useState<ReplanResult | null>(null);

  // Synchronize internal state when initialItinerary prop changes (e.g., when reloading from Firestore)
  useEffect(() => {
    if (initialItinerary) {
      setItinerary(initialItinerary);
    }
  }, [initialItinerary]);

  // Display toast feedback helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const toggleReason = (activityId: string) => {
    setExpandedReasons((prev) => ({
      ...prev,
      [activityId]: !prev[activityId],
    }));
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `${trip.name} - TravelPilot Itinerary`,
          text: `Check out our ${itinerary.days.length}-day trip itinerary for ${trip.destination}!`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setShowShareNotification(true);
      setTimeout(() => setShowShareNotification(false), 3000);
    }
  };

  // -------------------------------------------------------------
  // Progress State Tracking (Requirements 1, 2, 4, 5, 7, 14)
  // Single source of truth derived from current itinerary
  // -------------------------------------------------------------
  const tripProgress = calculateTripProgress(itinerary);
  const {
    totalActivities,
    completedActivities,
    skippedActivities,
    disruptedActivities,
    resolvedActivities,
    pendingActivities,
    percent: progressPercent,
    isComplete: isTripComplete,
  } = tripProgress;

  // Persist updated itinerary into state and Firestore immediately
  const commitItineraryUpdate = async (updated: TripItinerary, feedbackMsg?: string) => {
    setItinerary(updated);
    if (onUpdateItinerary) {
      onUpdateItinerary(updated);
    }
    try {
      if (trip.id) {
        await saveTripItinerary(trip.id, updated);
      }
    } catch (err) {
      console.error('[TravelPilot] Cloud Firestore synchronization error:', err);
      showToast('Notice: Cloud sync will retry, local progress preserved.');
    }
    if (feedbackMsg) {
      showToast(feedbackMsg);
    }
  };

  // Remove Activity handler
  const handleConfirmRemoveActivity = async () => {
    if (!activityToRemove) return;
    try {
      setIsRemovingActivity(true);
      const updated = deleteActivityFromItinerary(
        itinerary,
        activityToRemove.dayNumber,
        activityToRemove.candidateId
      );
      await commitItineraryUpdate(
        updated,
        `"${activityToRemove.name}" removed from itinerary.`
      );
      setActivityToRemove(null);
    } catch (err: unknown) {
      console.error('Failed to remove activity:', err);
      showToast('Unable to remove activity. Please try again.');
    } finally {
      setIsRemovingActivity(false);
    }
  };

  // Edit Trip Name handler
  const handleSaveTripName = async (e?: React.FormEvent) => {
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
      setCurrentTripName(updated.name);
      onUpdateTripName?.(updated.name);
      setIsEditingName(false);
      showToast('Trip name updated successfully.');
    } catch (err: unknown) {
      setEditNameError(err instanceof Error ? err.message : 'Unable to update trip name.');
    } finally {
      setIsSavingName(false);
    }
  };

  // Mark activity status (completed, skipped, planned)
  const handleMarkStatus = async (
    dayNumber: number,
    candidateId: string,
    newStatus: ActivityStatus
  ) => {
    const updated = updateActivityStatus(itinerary, dayNumber, candidateId, newStatus);
    const label =
      newStatus === 'completed'
        ? 'Activity marked as completed! Unaffected schedule preserved.'
        : newStatus === 'skipped'
        ? 'Activity marked as skipped.'
        : 'Activity restored to planned.';
    await commitItineraryUpdate(updated, label);
  };

  // Open Disruption Modal for a specific activity
  const handleOpenDisruptionForActivity = (dayNumber: number, act: ItineraryActivity) => {
    setTargetActivity({ dayNumber, activity: act });
    setIsDisruptionModalOpen(true);
  };

  // Open Disruption Modal generally from the header
  const handleOpenGeneralDisruption = () => {
    // Default to the first pending activity
    for (const day of itinerary.days) {
      const active = day.activities.find((a) => a.status !== 'completed' && a.status !== 'skipped');
      if (active) {
        setTargetActivity({ dayNumber: day.dayNumber, activity: active });
        break;
      }
    }
    setIsDisruptionModalOpen(true);
  };

  // Submit Disruption & Run Constrained Replanning (Requirements 5, 6, 8)
  const handleSubmitDisruption = async (disruption: DisruptionReport) => {
    setIsAnalyzingDisruption(true);
    try {
      // Find current anchor location from progress:
      // If user has completed an activity today, anchor to that activity's area
      const targetDay = itinerary.days.find((d) => d.dayNumber === disruption.dayNumber);
      const completedToday = (targetDay?.activities || []).filter((a) => a.status === 'completed');
      const lastCompleted = completedToday[completedToday.length - 1];
      const anchor = lastCompleted ? `${lastCompleted.name}, ${lastCompleted.area}` : undefined;

      const result = await analyzeAndReplanDisruption({
        itinerary,
        disruption,
        userLocation: anchor,
      });

      setReplanResult(result);
      setIsDisruptionModalOpen(false);
      setIsReplanModalOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Replanning analysis failed.';
      showToast(`Replanning error: ${msg}`);
    } finally {
      setIsAnalyzingDisruption(false);
    }
  };

  // Accept a selected replacement alternative (Requirement 9)
  const handleAcceptReplacement = async (alternative: ReplacementAlternative) => {
    if (!replanResult) return;
    setIsApplyingReplacement(true);

    try {
      const dayNum = replanResult.impact.dayNumber;
      const disruptedId = replanResult.impact.disruptedActivity.candidateId;
      const reason = replanResult.impact.disruptedActivity.disruptionReason || 'Disruption occurred';

      const updated = applyReplacementToItinerary(
        itinerary,
        dayNum,
        disruptedId,
        alternative,
        reason
      );

      await commitItineraryUpdate(
        updated,
        `Itinerary updated: ${alternative.name} scheduled on Day ${dayNum}. Other days & completed stops preserved.`
      );

      setIsReplanModalOpen(false);
      setReplanResult(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to apply replacement.';
      showToast(`Update error: ${msg}`);
    } finally {
      setIsApplyingReplacement(false);
    }
  };

  // Skip without replacement (leave free leisure time)
  const handleSkipWithoutReplacement = async () => {
    if (!replanResult) return;
    setIsApplyingReplacement(true);

    try {
      const dayNum = replanResult.impact.dayNumber;
      const disruptedId = replanResult.impact.disruptedActivity.candidateId;

      const updated = removeActivityFromItinerary(
        itinerary,
        dayNum,
        disruptedId,
        'User chose leisure time'
      );

      await commitItineraryUpdate(
        updated,
        `Activity removed from Day ${dayNum}. Downstream schedule preserved.`
      );

      setIsReplanModalOpen(false);
      setReplanResult(null);
    } finally {
      setIsApplyingReplacement(false);
    }
  };

  const origin = itinerary.transportation?.origin || itinerary.planningSnapshot?.origin;
  const destination = trip.destination || itinerary.destination;
  const transportOptions: TransportOption[] = itinerary.transportation?.options || [];

  const visibleDays =
    selectedDayNumber === 'all'
      ? itinerary.days
      : itinerary.days.filter((d) => d.dayNumber === selectedDayNumber);

  return (
    <div id="itinerary-view-container" className="space-y-8 animate-fadeIn">
      {/* Toast Feedback Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-stone-700 animate-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-stone-400 hover:text-white ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner & Header */}
      <div
        id="itinerary-header-card"
        className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-sm"
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 pb-6 border-b border-stone-100">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-full text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Planned by TravelPilot AI</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 id="itinerary-title" className="text-2xl sm:text-3xl font-bold text-stone-900">
                {currentTripName}
              </h1>
              {canEdit && (
                <button
                  type="button"
                  id="itinerary-edit-title-btn"
                  onClick={() => {
                    setEditNameValue(currentTripName);
                    setEditNameError(null);
                    setIsEditingName(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#0F4C5C] bg-[#EBF3F5] hover:bg-[#D0E5E8] rounded-lg transition"
                  title="Edit Trip Name"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Name</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600 pt-1">
              <span className="inline-flex items-center gap-1.5 font-medium text-stone-800">
                <MapPin className="w-4 h-4 text-emerald-600" />
                {trip.destination}
                {itinerary.planningSnapshot?.region && ` (${itinerary.planningSnapshot.region})`}
              </span>
              <span className="text-stone-300">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-stone-500" />
                {itinerary.days.length} Days ({trip.startDate} to {trip.endDate})
              </span>
              <span className="text-stone-300">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-blue-600" />
                {itinerary.planningSnapshot?.travelStyle || 'Balanced'} Pace
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onEditPreferences && (
              <button
                id="itinerary-edit-preferences-button"
                onClick={onEditPreferences}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-semibold rounded-xl transition"
              >
                <Sliders className="w-4 h-4 text-stone-600" />
                <span>Adjust Preferences</span>
              </button>
            )}

            {onReplan && (
              <button
                id="itinerary-replan-button"
                onClick={onReplan}
                disabled={isReplanning}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold rounded-xl transition shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isReplanning ? 'animate-spin' : ''}`} />
                <span>{isReplanning ? 'Regenerating...' : 'Regenerate Entire Plan'}</span>
              </button>
            )}

            <button
              id="itinerary-share-button"
              onClick={handleShare}
              className="p-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition relative"
              title="Share itinerary link"
            >
              <Share2 className="w-4 h-4" />
              {showShareNotification && (
                <span className="absolute -bottom-8 right-0 bg-stone-900 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap">
                  Link copied!
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* ADAPTIVE TRIP PROGRESS & DISRUPTION MONITORING BAR */}
        {/* ------------------------------------------------------------- */}
        <div
          id="itinerary-disruption-tracker-bar"
          className="mt-6 p-4 sm:p-5 bg-gradient-to-r from-stone-50 via-amber-50/30 to-stone-50 border border-stone-200 rounded-xl space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Progress Metrics */}
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Trip Progress & Disruption Tracker
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {resolvedActivities} of {totalActivities} Resolved ({progressPercent}%)
                  {isTripComplete && ' • 100% Completed'}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden max-w-md">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs text-stone-500 pt-0.5">
                <span>{pendingActivities} pending</span>
                {completedActivities > 0 && <span>• {completedActivities} completed</span>}
                {skippedActivities > 0 && <span>• {skippedActivities} skipped</span>}
                {disruptedActivities > 0 && (
                  <span className="text-amber-700 font-medium">• {disruptedActivities} disrupted</span>
                )}
                {itinerary.replanLogs && itinerary.replanLogs.length > 0 && (
                  <button
                    onClick={() => setShowAuditHistory(!showAuditHistory)}
                    className="text-stone-700 font-semibold underline flex items-center gap-1 hover:text-stone-900"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{itinerary.replanLogs.length} Replan Log{itinerary.replanLogs.length === 1 ? '' : 's'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Disruption Action Buttons (Requirements 2, 3, 15) */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {/* Simulate Disruption Button */}
              <button
                type="button"
                id="simulate-disruption-quick-btn"
                onClick={handleOpenGeneralDisruption}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                title="Simulate venue closure, weather, transit delay, or traffic issue"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Simulate Disruption</span>
              </button>

              {/* Report Issue Button */}
              <button
                type="button"
                id="report-disruption-quick-btn"
                onClick={handleOpenGeneralDisruption}
                className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                title="Report venue closure, road block, transit delay, or cost issue"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Report Issue / Disruption</span>
              </button>
            </div>
          </div>

          {/* Last Replan Explanation Banner if available */}
          {itinerary.lastReplanExplanation && (
            <div className="p-3 bg-white border border-stone-200 rounded-lg text-xs text-stone-700 flex items-start gap-2">
              <Compass className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-stone-900">Recent Adaptive Repair: </span>
                <span>{itinerary.lastReplanExplanation}</span>
              </div>
            </div>
          )}

          {/* Replan Audit History expandable */}
          {showAuditHistory && itinerary.replanLogs && itinerary.replanLogs.length > 0 && (
            <div className="p-3 bg-white border border-stone-200 rounded-lg text-xs space-y-2 animate-in fade-in">
              <span className="font-bold text-stone-800 block border-b pb-1">
                Itinerary Change History (Constrained Replanning Audit)
              </span>
              <ul className="space-y-1.5 text-stone-600">
                {itinerary.replanLogs.map((log) => (
                  <li key={log.id} className="flex items-start gap-2">
                    <span className="font-bold text-stone-800 whitespace-nowrap">
                      Day {log.dayNumber}:
                    </span>
                    <span>{log.summary}</span>
                    <span className="text-[10px] text-stone-400 ml-auto">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 mt-6 border-t border-stone-100">
          <div className="flex items-center gap-3.5 p-3 rounded-xl bg-stone-50/60 border border-stone-100">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-stone-500">Total Estimated Cost</div>
              <div className="text-lg font-bold text-stone-900">
                ₹{itinerary.totalEstimatedCost.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-stone-400">
                Across all {itinerary.days.length} planned days (Estimated)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3 rounded-xl bg-stone-50/60 border border-stone-100">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-stone-500">Daily Target Budget</div>
              <div className="text-lg font-bold text-stone-900">
                ₹{itinerary.dailyBudget.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-stone-400">
                Estimated total budget: ₹{(itinerary.dailyBudget * itinerary.days.length).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3 rounded-xl bg-stone-50/60 border border-stone-100">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-stone-500">Traveler Dynamics</div>
              <div className="text-lg font-bold text-stone-900 capitalize">
                {itinerary.planningSnapshot?.tripType} Trip ({itinerary.planningSnapshot?.travelers} Travelers)
              </div>
              <div className="text-[11px] text-stone-400 truncate max-w-[200px]">
                {itinerary.planningSnapshot?.interests?.join(', ') || 'Custom highlights'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION A: GETTING THERE */}
      {transportOptions.length > 0 && (
        <section id="section-getting-there" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-emerald-600" />
                Getting to {destination}
              </h2>
              <p className="text-xs text-stone-500">
                {origin ? `Recommended transport routes from ${origin}` : `Key transit connections for ${destination}`}
              </p>
            </div>
          </div>

          {/* Transport summary note */}
          {itinerary.transportation?.summary && (
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700">
              {itinerary.transportation.summary}
            </div>
          )}

          {/* Transport Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {transportOptions.map((opt, idx) => (
              <div
                key={idx}
                id={`transport-option-${opt.mode}-${idx}`}
                className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3 hover:border-stone-300 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center">
                      {getTransportIcon(opt.mode)}
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm sm:text-base">
                        {opt.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <span className="font-semibold text-stone-700">{opt.costEstimate}</span>
                        <span>•</span>
                        <span>{opt.estimatedDuration}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed">
                  {opt.description}
                </p>

                {opt.actionUrl && (
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                    <a
                      id={`transport-action-${idx}`}
                      href={opt.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                    >
                      <span>{opt.actionLabel || 'Check Availability'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <span className="text-[10px] text-stone-400">External Provider</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION B: ACCOMMODATION & STAY */}
      <StaySection
        trip={currentTrip}
        canEdit={canEdit}
        onTripUpdated={handleTripUpdated}
      />

      {/* SECTION B: YOUR DAY-BY-DAY ITINERARY */}
      <section id="section-your-itinerary" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-900">Your Day-by-Day Schedule</h2>
            <p className="text-xs text-stone-500">
              Interactive itinerary. Mark stops completed or report disruptions to replan on the go.
            </p>
          </div>

          {/* Day Selector Pills */}
          <div id="itinerary-day-filter-bar" className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              id="day-filter-all"
              onClick={() => setSelectedDayNumber('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                selectedDayNumber === 'all'
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
              }`}
            >
              All Days ({itinerary.days.length})
            </button>

            {itinerary.days.map((d) => {
              const dStats = calculateDayProgress(d);
              return (
                <button
                  key={d.dayNumber}
                  id={`day-filter-${d.dayNumber}`}
                  onClick={() => setSelectedDayNumber(d.dayNumber)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    selectedDayNumber === d.dayNumber
                      ? 'bg-stone-900 text-white shadow-sm'
                      : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <span>Day {d.dayNumber}</span>
                  {dStats.isComplete ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : dStats.resolved > 0 ? (
                    <span className="text-[10px] opacity-80">({dStats.percent}%)</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day-by-Day Cards */}
        <div id="itinerary-days-container" className="space-y-6">
          {visibleDays.map((day) => {
            const dayStats = calculateDayProgress(day);
            return (
              <div
                key={day.dayNumber}
                id={`itinerary-day-card-${day.dayNumber}`}
                className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6"
              >
                {/* Day Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-stone-100">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white ${
                        dayStats.isComplete ? 'bg-emerald-600' : 'bg-stone-900'
                      }`}
                    >
                      {dayStats.isComplete ? <Check className="w-5 h-5" /> : day.dayNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-stone-900">
                          Day {day.dayNumber} — {day.date}
                        </h3>
                        {dayStats.isComplete ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            <span>Day Complete</span>
                          </span>
                        ) : dayStats.resolved > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-700 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-full">
                            <span>{dayStats.percent}% Complete</span>
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-stone-500">
                        {dayStats.resolved} of {dayStats.total} activities resolved ({dayStats.percent}%) • {dayStats.pending} pending
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    {dayStats.isComplete && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        All activities resolved
                      </span>
                    )}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-700">
                      <span>Estimated Day Cost:</span>
                      <span className="text-emerald-700 font-bold">
                        ₹{day.estimatedDailyCost.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Daily Accommodation Anchor Banner */}
                {currentTrip.stay?.mode === 'existing' && (
                  <div
                    id={`day-${day.dayNumber}-stay-banner`}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl text-xs text-[#57534E]"
                  >
                    <Building2 className="w-4 h-4 text-[#0F4C5C] shrink-0" />
                    <span>
                      {day.dayNumber === 1 ? (
                        <>
                          <strong className="text-[#1C1917]">Check-in &amp; Base Anchor:</strong>{' '}
                          {currentTrip.stay.name} ({currentTrip.stay.checkInTime || '14:00'}) • {currentTrip.stay.address}
                        </>
                      ) : day.dayNumber === itinerary.days.length ? (
                        <>
                          <strong className="text-[#1C1917]">Base Anchor &amp; Check-out:</strong>{' '}
                          {currentTrip.stay.name} ({currentTrip.stay.checkOutTime || '11:00'}) • {currentTrip.stay.address}
                        </>
                      ) : (
                        <>
                          <strong className="text-[#1C1917]">Daily Base Anchor:</strong>{' '}
                          {currentTrip.stay.name} • {currentTrip.stay.address}
                        </>
                      )}
                    </span>
                  </div>
                )}

                {/* Activities Timeline */}
                <div className="space-y-4">
                {day.activities.map((act, actIdx) => {
                  const uniqueKey = `${day.dayNumber}-${act.candidateId}-${actIdx}`;
                  const isExpanded = expandedReasons[uniqueKey];
                  const isCompleted = act.status === 'completed';
                  const isSkipped = act.status === 'skipped';
                  const isDisrupted = act.status === 'disrupted';
                  const isReplacement = act.isReplacement;

                  return (
                    <div
                      key={uniqueKey}
                      id={`activity-item-${act.candidateId}`}
                      className={`relative pl-6 sm:pl-8 before:absolute before:left-2 sm:before:left-3 before:top-4 before:bottom-0 before:w-0.5 before:bg-stone-200 last:before:hidden ${
                        isSkipped ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Circle marker */}
                      <div
                        className={`absolute left-0 sm:left-1 top-2.5 w-4 h-4 rounded-full border-2 bg-white ${
                          isCompleted
                            ? 'border-emerald-600 bg-emerald-600'
                            : isDisrupted
                            ? 'border-amber-500 bg-amber-500'
                            : 'border-emerald-600'
                        }`}
                      />

                      <div
                        className={`rounded-xl p-4 sm:p-5 transition border ${
                          isCompleted
                            ? 'bg-emerald-50/30 border-emerald-200'
                            : isDisrupted
                            ? 'bg-amber-50/40 border-amber-300'
                            : isReplacement
                            ? 'bg-blue-50/20 border-blue-200'
                            : 'bg-stone-50/80 hover:bg-stone-50 border-stone-200/80'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            {/* Sequence & Dynamic Status Pills */}
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-semibold text-[#2E5658] bg-[#EEF4F3] px-2.5 py-0.5 rounded-full border border-[#D3E2E0] text-[11px]">
                                Stop {actIdx + 1}
                              </span>

                              {/* Dynamic Status Badges */}
                              {isCompleted && (
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full text-[11px]">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                  <span>Completed</span>
                                </span>
                              )}

                              {isSkipped && (
                                <span className="inline-flex items-center gap-1 font-semibold text-stone-600 bg-stone-200 px-2 py-0.5 rounded-full text-[11px]">
                                  <span>Skipped</span>
                                </span>
                              )}

                              {isDisrupted && (
                                <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full text-[11px]">
                                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                                  <span>Disrupted</span>
                                </span>
                              )}

                              {isReplacement && (
                                <span className="inline-flex items-center gap-1 font-bold text-blue-800 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-full text-[11px]">
                                  <RefreshCw className="w-3 h-3 text-blue-700" />
                                  <span>Replacement Activity</span>
                                </span>
                              )}

                              {act.travelTimeFromPrevious && (
                                <>
                                  <span className="text-stone-400">•</span>
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-100">
                                    {act.travelTimeFromPrevious}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Place Name & Category */}
                            <div className="pt-1">
                              <h4
                                className={`text-base sm:text-lg font-bold text-stone-900 ${
                                  isSkipped ? 'line-through text-stone-400' : ''
                                }`}
                              >
                                {act.name}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-xs text-stone-600 flex items-center gap-1 font-medium">
                                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                                  {act.area}
                                </span>
                                <span className="text-stone-300">•</span>
                                <span className="text-xs text-stone-600 font-medium bg-stone-200/60 px-2 py-0.5 rounded">
                                  {act.category}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Cost & External Link */}
                          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 pt-2 sm:pt-0 shrink-0">
                            <div className="text-right">
                              <div className="text-sm font-bold text-stone-900">
                                {act.estimatedCost === 0
                                  ? 'Free Entry'
                                  : `₹${act.estimatedCost.toLocaleString('en-IN')}`}
                              </div>
                              <div className="text-[11px] text-stone-500">(Estimated)</div>
                            </div>

                            <a
                              id={`maps-link-${act.candidateId}`}
                              href={act.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline pt-1"
                            >
                              <span>View on Google Maps</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        {/* Place Description / Note */}
                        {act.reason && (
                          <div className="mt-2.5 pt-2 border-t border-[#E8E2D9]/60">
                            <p className="text-xs text-[#5C6460] leading-relaxed">
                              {act.reason}
                            </p>
                          </div>
                        )}

                        {/* ------------------------------------------------------------- */}
                        {/* ACTIVITY PROGRESS & DISRUPTION ACTION CONTROLS (Requirement 2) */}
                        {/* ------------------------------------------------------------- */}
                        <div className="mt-3 pt-3 border-t border-stone-200/60 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Planned / Normal Activity Controls */}
                            {(!act.status || act.status === 'planned') && (
                              <>
                                <button
                                  type="button"
                                  id={`mark-completed-btn-${act.candidateId}`}
                                  onClick={() => handleMarkStatus(day.dayNumber, act.candidateId, 'completed')}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-semibold transition"
                                  title="Mark this stop as visited. Preserves historical log and ignores during replanning."
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Mark as Completed</span>
                                </button>

                                <button
                                  type="button"
                                  id={`skip-activity-btn-${act.candidateId}`}
                                  onClick={() => handleMarkStatus(day.dayNumber, act.candidateId, 'skipped')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium transition"
                                  title="Skip this activity without replanning"
                                >
                                  <span>Skip</span>
                                </button>

                                <button
                                  type="button"
                                  id={`report-issue-btn-${act.candidateId}`}
                                  onClick={() => handleOpenDisruptionForActivity(day.dayNumber, act)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold transition"
                                  title="Report closure, delay, booking issue, or road block"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Report Issue</span>
                                </button>
                              </>
                            )}

                            {/* Completed Status State */}
                            {isCompleted && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-semibold text-emerald-800 flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Completed</span>
                                </span>
                                <button
                                  type="button"
                                  id={`undo-completed-btn-${act.candidateId}`}
                                  onClick={() => handleMarkStatus(day.dayNumber, act.candidateId, 'planned')}
                                  className="text-stone-500 hover:text-stone-800 underline transition text-[11px]"
                                >
                                  (Undo)
                                </button>
                              </div>
                            )}

                            {/* Skipped Status State */}
                            {isSkipped && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-medium text-stone-500">Skipped by traveler</span>
                                <button
                                  type="button"
                                  id={`restore-skipped-btn-${act.candidateId}`}
                                  onClick={() => handleMarkStatus(day.dayNumber, act.candidateId, 'planned')}
                                  className="text-stone-700 hover:text-stone-900 underline font-medium transition text-[11px]"
                                >
                                  (Restore to Planned)
                                </button>
                              </div>
                            )}

                            {/* Disrupted Status State */}
                            {isDisrupted && (
                              <button
                                type="button"
                                id={`find-replacement-btn-${act.candidateId}`}
                                onClick={() => handleOpenDisruptionForActivity(day.dayNumber, act)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Find Replacements</span>
                              </button>
                            )}

                            {/* Remove Activity Action (Admin/Co-Admin) */}
                            {canEdit && (
                              <button
                                type="button"
                                id={`remove-activity-btn-${act.candidateId}`}
                                onClick={() =>
                                  setActivityToRemove({
                                    dayNumber: day.dayNumber,
                                    candidateId: act.candidateId,
                                    name: act.name,
                                  })
                                }
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-stone-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg text-xs font-medium transition"
                                title="Remove Activity from itinerary"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            )}
                          </div>

                          {/* Audit Note / Status Note */}
                          {act.statusNote && (
                            <span className="text-[11px] text-stone-500 italic">
                              {act.statusNote}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
              );
            })}
        </div>
      </section>

      {/* Bottom Navigation & Actions */}
      <div
        id="itinerary-bottom-bar"
        className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white border border-stone-200 rounded-2xl"
      >
        <div className="text-xs text-stone-500 text-center sm:text-left">
          All activity costs and transit durations are approximate estimates provided for travel planning.
        </div>

        <div className="flex items-center gap-3">
          {onBackToOverview && (
            <button
              id="itinerary-back-overview-button"
              onClick={onBackToOverview}
              className="px-4 py-2 border border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-medium rounded-xl transition"
            >
              Back to Trip Details
            </button>
          )}

          {onEditPreferences && (
            <button
              id="itinerary-replan-footer-button"
              onClick={onEditPreferences}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold rounded-xl transition"
            >
              Adjust Planning Parameters
            </button>
          )}
        </div>
      </div>

      {/* Disruption Reporting Modal */}
      <DisruptionReportModal
        isOpen={isDisruptionModalOpen}
        onClose={() => setIsDisruptionModalOpen(false)}
        itinerary={itinerary}
        preselectedDayNumber={targetActivity?.dayNumber}
        preselectedActivity={targetActivity?.activity}
        onSubmitDisruption={handleSubmitDisruption}
        isAnalyzing={isAnalyzingDisruption}
      />

      {/* Disruption Constrained Replanning Modal */}
      <DisruptionReplanModal
        isOpen={isReplanModalOpen}
        onClose={() => setIsReplanModalOpen(false)}
        replanResult={replanResult}
        onAcceptReplacement={handleAcceptReplacement}
        onSkipWithoutReplacement={handleSkipWithoutReplacement}
        isApplying={isApplyingReplacement}
      />

      {/* Remove Activity Confirmation Modal */}
      {activityToRemove && (
        <div
          id="modal-remove-activity"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-900">Remove Activity</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Remove this activity from your itinerary?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-stone-50 border border-stone-200/80 rounded-xl space-y-1">
              <div className="text-xs font-semibold text-stone-900">
                {activityToRemove.name}
              </div>
              <div className="text-[11px] text-stone-500">
                Day {activityToRemove.dayNumber} of trip schedule
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              This activity will be removed from your itinerary and trip progress stats will update automatically.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                id="cancel-remove-activity-btn"
                onClick={() => setActivityToRemove(null)}
                disabled={isRemovingActivity}
                className="px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-xl transition border border-stone-200"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-remove-activity-btn"
                onClick={handleConfirmRemoveActivity}
                disabled={isRemovingActivity}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50"
              >
                {isRemovingActivity ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Activity</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Trip Name Modal */}
      {isEditingName && (
        <div
          id="modal-edit-trip-name-itinerary"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white border border-[#E8E2D9] rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-[#E8E2D9]">
              <div className="flex items-center gap-2 text-[#1C1917] font-semibold text-lg">
                <Pencil className="w-4 h-4 text-[#0F4C5C]" />
                <span>Edit Trip Name</span>
              </div>
              <button
                type="button"
                id="btn-close-itinerary-edit-name"
                onClick={() => setIsEditingName(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTripName} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="input-itinerary-edit-trip-name"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#57534E]"
                >
                  Trip Name
                </label>
                <input
                  id="input-itinerary-edit-trip-name"
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  placeholder="e.g. Summer in Tokyo"
                  className="w-full px-3.5 py-2.5 border border-[#E8E2D9] rounded-xl text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] focus:border-transparent transition"
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
                <button
                  type="button"
                  id="btn-cancel-itinerary-edit-name"
                  onClick={() => setIsEditingName(false)}
                  disabled={isSavingName}
                  className="px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-xl transition border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-itinerary-edit-name"
                  disabled={isSavingName || !editNameValue.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F4C5C] hover:bg-[#0c3c49] text-white rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50"
                >
                  {isSavingName ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Name</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

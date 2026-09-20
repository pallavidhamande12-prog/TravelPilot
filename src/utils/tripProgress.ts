import { TripItinerary, ItineraryDay, ItineraryActivity, TripStatus } from '../types';

export interface DayProgressStats {
  dayNumber: number;
  date: string;
  total: number;
  completed: number;
  skipped: number;
  disrupted: number;
  resolved: number;
  pending: number;
  percent: number;
  isComplete: boolean;
}

export interface TripProgressStats {
  totalActivities: number;
  completedActivities: number;
  skippedActivities: number;
  disruptedActivities: number;
  resolvedActivities: number;
  pendingActivities: number;
  percent: number;
  isComplete: boolean;
  derivedStatus: TripStatus;
  statusLabel: 'Completed' | 'In Progress' | 'Planning';
  days: DayProgressStats[];
}

/**
 * Filter out superseded activities if both original (replaced) and replacement exist
 * in the same day's activities list, ensuring we represent only current activities.
 */
export function getCurrentActivities(activities: ItineraryActivity[]): ItineraryActivity[] {
  if (!activities || activities.length === 0) return [];

  // If an activity has been superseded by a replacement item in the same array,
  // exclude the original replaced item so that it is not counted twice.
  const replacementTargetIds = new Set(
    activities
      .map((a) => a.replacementForCandidateId)
      .filter((id): id is string => Boolean(id))
  );

  return activities.filter((act) => {
    if (act.status === 'replaced' && replacementTargetIds.has(act.candidateId)) {
      return false;
    }
    return true;
  });
}

/**
 * Check if a single activity is considered resolved for progress tracking.
 * Resolved = completed, skipped, or replaced (if not superseded).
 */
export function isActivityResolved(act: ItineraryActivity): boolean {
  return act.status === 'completed' || act.status === 'skipped' || act.status === 'replaced';
}

/**
 * Check if a single activity is pending/unresolved.
 */
export function isActivityPending(act: ItineraryActivity): boolean {
  return !act.status || act.status === 'planned' || act.status === 'disrupted';
}

/**
 * Calculate progress metrics for a single itinerary day.
 */
export function calculateDayProgress(day: ItineraryDay): DayProgressStats {
  const currentActs = getCurrentActivities(day.activities || []);
  const total = currentActs.length;
  const completed = currentActs.filter((a) => a.status === 'completed').length;
  const skipped = currentActs.filter((a) => a.status === 'skipped').length;
  const disrupted = currentActs.filter((a) => a.status === 'disrupted').length;
  const resolved = currentActs.filter(isActivityResolved).length;
  const pending = currentActs.filter(isActivityPending).length;

  const percent = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const isComplete = total > 0 && resolved === total;

  return {
    dayNumber: day.dayNumber,
    date: day.date,
    total,
    completed,
    skipped,
    disrupted,
    resolved,
    pending,
    percent,
    isComplete,
  };
}

/**
 * Calculate overall trip-level progress metrics from the current persisted itinerary.
 * This is the single source of truth used across the dashboard, trip details, and itinerary views.
 */
export function calculateTripProgress(itinerary?: TripItinerary | null): TripProgressStats {
  if (!itinerary || !itinerary.days || itinerary.days.length === 0) {
    return {
      totalActivities: 0,
      completedActivities: 0,
      skippedActivities: 0,
      disruptedActivities: 0,
      resolvedActivities: 0,
      pendingActivities: 0,
      percent: 0,
      isComplete: false,
      derivedStatus: 'Planning',
      statusLabel: 'Planning',
      days: [],
    };
  }

  const daysStats = itinerary.days.map(calculateDayProgress);

  const totalActivities = daysStats.reduce((sum, d) => sum + d.total, 0);
  const completedActivities = daysStats.reduce((sum, d) => sum + d.completed, 0);
  const skippedActivities = daysStats.reduce((sum, d) => sum + d.skipped, 0);
  const disruptedActivities = daysStats.reduce((sum, d) => sum + d.disrupted, 0);
  const resolvedActivities = daysStats.reduce((sum, d) => sum + d.resolved, 0);
  const pendingActivities = daysStats.reduce((sum, d) => sum + d.pending, 0);

  const percent =
    totalActivities > 0 ? Math.round((resolvedActivities / totalActivities) * 100) : 0;
  const isComplete = totalActivities > 0 && resolvedActivities === totalActivities;

  let derivedStatus: TripStatus = 'Planning';
  let statusLabel: 'Completed' | 'In Progress' | 'Planning' = 'Planning';

  if (isComplete) {
    derivedStatus = 'Completed';
    statusLabel = 'Completed';
  } else if (resolvedActivities > 0) {
    derivedStatus = 'Active';
    statusLabel = 'In Progress';
  } else if (itinerary.days.length > 0) {
    derivedStatus = 'Active';
    statusLabel = 'Planning';
  }

  return {
    totalActivities,
    completedActivities,
    skippedActivities,
    disruptedActivities,
    resolvedActivities,
    pendingActivities,
    percent,
    isComplete,
    derivedStatus,
    statusLabel,
    days: daysStats,
  };
}

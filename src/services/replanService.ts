import {
  TripItinerary,
  DisruptionReport,
  ReplanResult,
  ReplacementAlternative,
  ActivityStatus,
  ReplanAuditLog,
} from '../types';

/**
 * Call the server replanning engine to analyze disruption impact and generate
 * 2-3 tightly grounded alternatives within close proximity of the user's current anchor.
 */
export async function analyzeAndReplanDisruption(params: {
  itinerary: TripItinerary;
  disruption: DisruptionReport;
  userLocation?: string;
}): Promise<ReplanResult> {
  const response = await fetch('/api/plan/replan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok || data.status === 'error') {
    throw new Error(data.message || 'Failed to analyze disruption and generate replacements.');
  }

  return data as ReplanResult;
}

/**
 * Apply a selected replacement alternative into the itinerary.
 * ONLY touches the affected day and slot — completely preserves completed activities
 * and other days.
 */
export function applyReplacementToItinerary(
  itinerary: TripItinerary,
  dayNumber: number,
  disruptedCandidateId: string,
  selectedAlternative: ReplacementAlternative,
  disruptionReason: string
): TripItinerary {
  // Deep clone days to ensure React re-render & pure state
  const updatedDays = itinerary.days.map((day) => {
    if (day.dayNumber !== dayNumber) {
      return day;
    }

    const updatedActivities = day.activities.map((act) => {
      if (act.candidateId === disruptedCandidateId || act.name === disruptedCandidateId) {
        return {
          candidateId: selectedAlternative.id,
          name: selectedAlternative.name,
          area: selectedAlternative.area,
          category: selectedAlternative.category,
          startTime: selectedAlternative.startTime || act.startTime,
          endTime: selectedAlternative.endTime || act.endTime,
          durationMinutes: selectedAlternative.durationMinutes || act.durationMinutes,
          estimatedCost: selectedAlternative.estimatedCost,
          travelTimeFromPrevious: selectedAlternative.travelTimeFromCurrent || act.travelTimeFromPrevious,
          mapsUrl: selectedAlternative.mapsUrl,
          reason: selectedAlternative.reason,
          distanceToNext: act.distanceToNext,
          status: 'planned' as ActivityStatus,
          isReplacement: true,
          replacementForCandidateId: act.candidateId,
          statusNote: `Replacement for ${act.name} (${disruptionReason})`,
        };
      }
      return act;
    });

    const estimatedDailyCost = updatedActivities
      .filter((a) => a.status !== 'skipped' && a.status !== 'replaced')
      .reduce((sum, a) => sum + (a.estimatedCost || 0), 0);

    return {
      ...day,
      activities: updatedActivities,
      estimatedDailyCost,
    };
  });

  const totalEstimatedCost = updatedDays.reduce((sum, d) => sum + d.estimatedDailyCost, 0);

  const newLog: ReplanAuditLog = {
    id: `replan-log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    dayNumber,
    disruptedActivityName: disruptedCandidateId,
    disruptionReason,
    replacementActivityName: selectedAlternative.name,
    actionTaken: 'replaced',
    summary: `Replaced with ${selectedAlternative.name} (${selectedAlternative.distanceFromCurrent} away). Preserved all remaining Day ${dayNumber} and subsequent day activities.`,
  };

  const replanLogs = [...(itinerary.replanLogs || []), newLog];

  return {
    ...itinerary,
    days: updatedDays,
    totalEstimatedCost,
    replanLogs,
    lastReplanExplanation: `Repaired Day ${dayNumber}: Replaced ${disruptedCandidateId} with ${selectedAlternative.name} (${selectedAlternative.distanceFromCurrent}). Downstream activities and other days preserved.`,
  };
}

/**
 * Remove a disrupted activity without replacement (e.g. user chooses leisure time),
 * keeping unaffected and completed activities intact.
 */
export function removeActivityFromItinerary(
  itinerary: TripItinerary,
  dayNumber: number,
  candidateId: string,
  reason: string
): TripItinerary {
  const updatedDays = itinerary.days.map((day) => {
    if (day.dayNumber !== dayNumber) return day;

    const updatedActivities = day.activities.map((act) => {
      if (act.candidateId === candidateId || act.name === candidateId) {
        return {
          ...act,
          status: 'skipped' as ActivityStatus,
          disruptionReason: reason,
          statusNote: `Skipped: ${reason}`,
        };
      }
      return act;
    });

    const estimatedDailyCost = updatedActivities
      .filter((a) => a.status !== 'skipped' && a.status !== 'replaced')
      .reduce((sum, a) => sum + (a.estimatedCost || 0), 0);

    return {
      ...day,
      activities: updatedActivities,
      estimatedDailyCost,
    };
  });

  const totalEstimatedCost = updatedDays.reduce((sum, d) => sum + d.estimatedDailyCost, 0);

  const newLog: ReplanAuditLog = {
    id: `replan-log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    dayNumber,
    disruptedActivityName: candidateId,
    disruptionReason: reason,
    actionTaken: 'removed_and_adjusted',
    summary: `Marked activity as skipped (${reason}). Downstream schedule preserved.`,
  };

  return {
    ...itinerary,
    days: updatedDays,
    totalEstimatedCost,
    replanLogs: [...(itinerary.replanLogs || []), newLog],
    lastReplanExplanation: `Adjusted Day ${dayNumber}: Skipped activity and freed up scheduled time. Other activities unchanged.`,
  };
}

/**
 * Update an activity's progress status (completed, skipped, planned, disrupted).
 * Simple, beginner-friendly 1-click update.
 */
export function updateActivityStatus(
  itinerary: TripItinerary,
  dayNumber: number,
  candidateId: string,
  newStatus: ActivityStatus,
  note?: string
): TripItinerary {
  const updatedDays = itinerary.days.map((day) => {
    if (day.dayNumber !== dayNumber) return day;

    const updatedActivities = day.activities.map((act) => {
      if (act.candidateId === candidateId || act.name === candidateId) {
        const updatedAct = {
          ...act,
          status: newStatus,
        };

        if (note) {
          updatedAct.statusNote = note;
        } else if (newStatus === 'completed') {
          updatedAct.statusNote = 'Marked as completed';
        } else if (newStatus === 'skipped') {
          updatedAct.statusNote = 'Skipped by traveler';
        } else {
          delete updatedAct.statusNote;
        }

        if (newStatus === 'completed') {
          updatedAct.completedAt = new Date().toISOString();
        } else {
          delete updatedAct.completedAt;
        }

        return updatedAct;
      }
      return act;
    });

    return {
      ...day,
      activities: updatedActivities,
    };
  });

  return {
    ...itinerary,
    days: updatedDays,
  };
}

/**
 * Permanently remove an activity from the itinerary.
 * Removes the target activity from the day's activities array, updates daily and total costs,
 * resolves/cleans up any associated disruption reports, and logs the removal in replanLogs.
 *
 * Requirements:
 * 1. If removing a replacement activity, do NOT restore the original superseded activity.
 * 2. If removing a completed or skipped activity, it is removed and no longer contributes to progress.
 * 3. If removing a disrupted activity, any pending disruption is resolved/cleaned up so no broken reference remains.
 * 4. Daily and total estimated costs are recalculated without the removed activity.
 */
export function deleteActivityFromItinerary(
  itinerary: TripItinerary,
  dayNumber: number,
  candidateId: string
): TripItinerary {
  let removedActivityName = candidateId;

  const updatedDays = itinerary.days.map((day) => {
    if (day.dayNumber !== dayNumber) return day;

    const targetAct = day.activities.find(
      (a) => a.candidateId === candidateId || a.name === candidateId
    );
    if (targetAct) {
      removedActivityName = targetAct.name;
    }

    // Filter out the target activity completely from this day's activities
    // Also ensure that if this was a replacement, the replaced predecessor is NOT restored
    const updatedActivities = day.activities.filter((act) => {
      if (act.candidateId === candidateId || act.name === candidateId) {
        return false;
      }
      if (
        targetAct?.replacementForCandidateId &&
        (act.candidateId === targetAct.replacementForCandidateId ||
          act.name === targetAct.replacementForCandidateId)
      ) {
        return false;
      }
      return true;
    });

    const estimatedDailyCost = updatedActivities
      .filter((a) => a.status !== 'skipped' && a.status !== 'replaced')
      .reduce((sum, a) => sum + (a.estimatedCost || 0), 0);

    return {
      ...day,
      activities: updatedActivities,
      estimatedDailyCost,
    };
  });

  const totalEstimatedCost = updatedDays.reduce((sum, d) => sum + d.estimatedDailyCost, 0);

  // Clean up any disruption reports referencing this activity (resolves the disruption)
  const updatedDisruptions = (itinerary.disruptions || []).filter(
    (d) =>
      d.activityCandidateId !== candidateId &&
      d.activityName !== candidateId &&
      d.activityName !== removedActivityName
  );

  const newLog: ReplanAuditLog = {
    id: `replan-log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    dayNumber,
    disruptedActivityName: removedActivityName,
    disruptionReason: 'Activity removed by user',
    actionTaken: 'removed_and_adjusted',
    summary: `Removed "${removedActivityName}" from Day ${dayNumber}. Schedule and progress recalculated.`,
  };

  return {
    ...itinerary,
    days: updatedDays,
    totalEstimatedCost,
    disruptions: updatedDisruptions,
    replanLogs: [...(itinerary.replanLogs || []), newLog],
    lastReplanExplanation: `Removed "${removedActivityName}" from Day ${dayNumber}. Schedule and progress recalculated.`,
  };
}


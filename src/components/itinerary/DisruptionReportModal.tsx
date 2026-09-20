import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Clock,
  Sparkles,
  MapPin,
  HelpCircle,
  TrendingDown,
  Navigation,
  CloudRain,
  CalendarX,
  Store,
} from 'lucide-react';
import { TripItinerary, ItineraryActivity, DisruptionReport, DisruptionType } from '../../types';

interface DisruptionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  itinerary: TripItinerary;
  preselectedDayNumber?: number;
  preselectedActivity?: ItineraryActivity | null;
  onSubmitDisruption: (disruption: DisruptionReport) => void;
  isAnalyzing: boolean;
}

const DISRUPTION_TYPES: { type: DisruptionType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'place_closed', label: 'Place is closed', icon: Store },
  { type: 'activity_unavailable', label: 'Unavailable / Fully booked', icon: CalendarX },
  { type: 'budget_exceeded', label: 'Budget exceeded / Ticket high', icon: TrendingDown },
  { type: 'route_unavailable', label: 'Route / Road blocked', icon: Navigation },
  { type: 'weather_issue', label: 'Weather / Rain', icon: CloudRain },
  { type: 'delay', label: 'Too much delay / Behind schedule', icon: Clock },
  { type: 'booking_cancelled', label: 'Booking cancelled', icon: AlertTriangle },
  { type: 'user_cannot_continue', label: 'Cannot continue with activity', icon: AlertTriangle },
  { type: 'other', label: 'Other issue', icon: HelpCircle },
];

const PRESET_SCENARIOS = [
  {
    type: 'place_closed' as DisruptionType,
    text: 'The venue is unexpectedly closed today for maintenance.',
    cost: undefined,
  },
  {
    type: 'budget_exceeded' as DisruptionType,
    text: 'Actual entry ticket is ₹850 instead of the expected price.',
    cost: 850,
  },
  {
    type: 'route_unavailable' as DisruptionType,
    text: 'Road to this location is temporarily blocked due to local roadworks.',
    cost: undefined,
  },
  {
    type: 'delay' as DisruptionType,
    text: 'Delayed by 45 minutes due to heavy traffic; need a closer alternative.',
    cost: undefined,
  },
];

export const DisruptionReportModal: React.FC<DisruptionReportModalProps> = ({
  isOpen,
  onClose,
  itinerary,
  preselectedDayNumber,
  preselectedActivity,
  onSubmitDisruption,
  isAnalyzing,
}) => {
  // Day selection
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(
    preselectedDayNumber || itinerary.days[0]?.dayNumber || 1
  );

  // Available activities for selected day
  const currentDay = itinerary.days.find((d) => d.dayNumber === selectedDayNumber) || itinerary.days[0];
  const eligibleActivities = (currentDay?.activities || []).filter(
    (a) => a.status !== 'completed' && a.status !== 'skipped'
  );

  // Activity selection
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(
    preselectedActivity?.candidateId || eligibleActivities[0]?.candidateId || ''
  );

  const [disruptionType, setDisruptionType] = useState<DisruptionType>('place_closed');
  const [description, setDescription] = useState<string>('The museum is closed today.');
  const [reportedCost, setReportedCost] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Update selection when preselected props change
  useEffect(() => {
    if (preselectedDayNumber) {
      setSelectedDayNumber(preselectedDayNumber);
    }
    if (preselectedActivity) {
      setSelectedCandidateId(preselectedActivity.candidateId);
    } else {
      const day = itinerary.days.find((d) => d.dayNumber === (preselectedDayNumber || 1)) || itinerary.days[0];
      const firstActive = day?.activities.find((a) => a.status !== 'completed');
      if (firstActive) {
        setSelectedCandidateId(firstActive.candidateId);
      }
    }
  }, [preselectedDayNumber, preselectedActivity, itinerary]);

  if (!isOpen) return null;

  const currentActivity =
    currentDay?.activities.find((a) => a.candidateId === selectedCandidateId) ||
    eligibleActivities[0] ||
    currentDay?.activities[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!currentActivity) {
      setValidationError('Please select an active activity to report a disruption for.');
      return;
    }

    if (!description.trim()) {
      setValidationError('Please enter a brief description of the disruption.');
      return;
    }

    const disruption: DisruptionReport = {
      id: `disrupt-${Date.now()}`,
      activityCandidateId: currentActivity.candidateId,
      activityName: currentActivity.name,
      dayNumber: selectedDayNumber,
      type: disruptionType,
      description: description.trim(),
      reportedActualCost: reportedCost ? parseFloat(reportedCost) : undefined,
      reportedAt: new Date().toISOString(),
    };

    onSubmitDisruption(disruption);
  };

  const handleApplyPreset = (preset: (typeof PRESET_SCENARIOS)[0]) => {
    setDisruptionType(preset.type);
    setDescription(preset.text);
    if (preset.cost !== undefined) {
      setReportedCost(String(preset.cost));
    } else {
      setReportedCost('');
    }
  };

  const handleSimulateDemo = () => {
    if (!currentActivity) return;
    const disruption: DisruptionReport = {
      id: `disrupt-demo-${Date.now()}`,
      activityCandidateId: currentActivity.candidateId,
      activityName: currentActivity.name,
      dayNumber: selectedDayNumber,
      type: 'place_closed',
      description: `The venue (${currentActivity.name}) is closed today for unscheduled maintenance.`,
      reportedAt: new Date().toISOString(),
    };
    onSubmitDisruption(disruption);
  };

  return (
    <div
      id="disruption-report-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="disruption-report-modal"
        className="bg-white border border-stone-200 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900">Report Itinerary Disruption</h2>
              <p className="text-xs text-stone-500">
                Tell TravelPilot what happened. We will adapt only the affected schedule.
              </p>
            </div>
          </div>
          <button
            id="close-disruption-modal-btn"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1">
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl">
              {validationError}
            </div>
          )}

          {/* Quick Simulation Option (Requirement 13) */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Simulate Disruption
              </span>
              <p className="text-xs text-amber-800/90">
                Simulate a sudden closure on the active activity to test real-time replanning.
              </p>
            </div>
            <button
              type="button"
              id="simulate-disruption-demo-btn"
              onClick={handleSimulateDemo}
              disabled={isAnalyzing || !currentActivity}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition shrink-0 shadow-xs flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Simulate Disruption</span>
            </button>
          </div>

          {/* Day & Activity Target */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
              Select Disrupted Activity
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Day Selector */}
              <div>
                <span className="block text-xs text-stone-500 mb-1">Day</span>
                <select
                  id="disruption-day-select"
                  value={selectedDayNumber}
                  onChange={(e) => {
                    const dayNum = Number(e.target.value);
                    setSelectedDayNumber(dayNum);
                    const newDay = itinerary.days.find((d) => d.dayNumber === dayNum);
                    const firstAct = newDay?.activities.find((a) => a.status !== 'completed');
                    if (firstAct) setSelectedCandidateId(firstAct.candidateId);
                  }}
                  className="w-full text-sm font-medium border border-stone-200 rounded-xl px-3 py-2.5 bg-stone-50 text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900"
                >
                  {itinerary.days.map((d) => (
                    <option key={d.dayNumber} value={d.dayNumber}>
                      Day {d.dayNumber} ({d.date})
                    </option>
                  ))}
                </select>
              </div>

              {/* Activity Selector */}
              <div>
                <span className="block text-xs text-stone-500 mb-1">Activity</span>
                <select
                  id="disruption-activity-select"
                  value={selectedCandidateId}
                  onChange={(e) => setSelectedCandidateId(e.target.value)}
                  className="w-full text-sm font-medium border border-stone-200 rounded-xl px-3 py-2.5 bg-stone-50 text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900"
                >
                  {currentDay?.activities.map((a) => (
                    <option key={a.candidateId} value={a.candidateId}>
                      {a.startTime} – {a.name} ({a.status || 'planned'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Target Activity Summary Card */}
            {currentActivity && (
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between text-stone-800 font-bold">
                  <span>{currentActivity.name}</span>
                  <span className="text-stone-500 font-medium">
                    {currentActivity.startTime} – {currentActivity.endTime}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-stone-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-stone-400" />
                    {currentActivity.area}
                  </span>
                  <span>•</span>
                  <span>{currentActivity.durationMinutes} mins</span>
                  <span>•</span>
                  <span>₹{currentActivity.estimatedCost} est.</span>
                </div>
              </div>
            )}
          </div>

          {/* Disruption Category */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
              What went wrong?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DISRUPTION_TYPES.map((t) => {
                const isSelected = disruptionType === t.type;
                const IconComponent = t.icon;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setDisruptionType(t.type)}
                    className={`p-2.5 text-left rounded-xl border text-xs font-semibold flex items-center gap-2 transition ${
                      isSelected
                        ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-2xs'
                        : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-600' : 'text-stone-400'}`} />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick-fill Scenario Chips */}
          <div className="space-y-1.5">
            <span className="text-xs text-stone-500 font-medium">Common scenarios:</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SCENARIOS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="px-2.5 py-1 text-[11px] font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition"
                >
                  {p.text}
                </button>
              ))}
            </div>
          </div>

          {/* Description textarea */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
              Description in Natural Language
            </label>
            <textarea
              id="disruption-description-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. The museum is closed today due to an unexpected holiday."
              className="w-full text-sm border border-stone-200 rounded-xl p-3 bg-stone-50 focus:bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 transition resize-none"
            />
          </div>

          {/* Actual Cost field if budget issue */}
          {disruptionType === 'budget_exceeded' && (
            <div className="space-y-1.5 p-3 bg-amber-50/50 border border-amber-200 rounded-xl animate-in fade-in duration-150">
              <label className="block text-xs font-bold text-amber-900">
                Reported Actual Cost (₹)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={reportedCost}
                onChange={(e) => setReportedCost(e.target.value)}
                placeholder="e.g. 850"
                className="w-full text-sm border border-amber-300 rounded-lg p-2 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-[11px] text-amber-700">
                TravelPilot will search for nearby free or lower-cost alternatives to safeguard your budget.
              </p>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isAnalyzing}
              className="px-4 py-2.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 text-sm font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-disruption-btn"
              disabled={isAnalyzing || !currentActivity}
              className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-bold rounded-xl transition shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Analyzing Impact...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Analyze Impact & Replan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

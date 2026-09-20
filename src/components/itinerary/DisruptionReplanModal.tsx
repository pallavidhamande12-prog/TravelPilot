import React from 'react';
import {
  X,
  Check,
  MapPin,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Tag,
  Compass,
} from 'lucide-react';
import { ReplanResult, ReplacementAlternative } from '../../types';

interface DisruptionReplanModalProps {
  isOpen: boolean;
  onClose: () => void;
  replanResult: ReplanResult | null;
  onAcceptReplacement: (alternative: ReplacementAlternative) => void;
  onSkipWithoutReplacement: () => void;
  isApplying: boolean;
}

export const DisruptionReplanModal: React.FC<DisruptionReplanModalProps> = ({
  isOpen,
  onClose,
  replanResult,
  onAcceptReplacement,
  onSkipWithoutReplacement,
  isApplying,
}) => {
  if (!isOpen || !replanResult) return null;

  const { impact, alternatives } = replanResult;

  return (
    <div
      id="disruption-replan-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="disruption-replan-modal"
        className="bg-white border border-stone-200 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900">Constrained Replanning</h2>
              <p className="text-xs text-stone-500">
                2–3 verified alternatives fitting your current location and schedule.
              </p>
            </div>
          </div>
          <button
            id="close-replan-modal-btn"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Impact Analysis Banner (Requirement 5) */}
          <div
            id="impact-analysis-box"
            className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Impact Analysis
                </span>
                <p className="text-sm font-medium text-stone-900 leading-relaxed">
                  {impact.impactSummary}
                </p>
              </div>
            </div>

            {/* Constraints & Invariants Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-stone-200/80 text-xs">
              <div className="p-2 bg-white rounded-lg border border-stone-100">
                <div className="text-stone-400 font-medium">Current Anchor</div>
                <div className="font-bold text-stone-800 truncate" title={impact.currentAnchorLocation}>
                  {impact.currentAnchorLocation.split(',')[0]}
                </div>
              </div>

              <div className="p-2 bg-white rounded-lg border border-stone-100">
                <div className="text-stone-400 font-medium">Time Slot</div>
                <div className="font-bold text-stone-800">
                  {impact.directlyAffectedTimeSlot}
                </div>
              </div>

              <div className="p-2 bg-white rounded-lg border border-stone-100">
                <div className="text-stone-400 font-medium">Completed</div>
                <div className="font-bold text-emerald-700 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{impact.completedActivitiesCount} Unchanged</span>
                </div>
              </div>

              <div className="p-2 bg-white rounded-lg border border-stone-100">
                <div className="text-stone-400 font-medium">Other Days</div>
                <div className="font-bold text-emerald-700 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{impact.unaffectedDaysCount} Untouched</span>
                </div>
              </div>
            </div>
          </div>

          {/* Replacement Alternatives Header */}
          <div className="space-y-1">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 flex items-center justify-between">
              <span>Nearby Replacement Options ({alternatives.length})</span>
              <span className="text-xs text-stone-400 font-normal">Choose one to update your itinerary</span>
            </h3>
            <p className="text-xs text-stone-500">
              Each option is located near your current spot, fits the open time slot, and preserves downstream activities.
            </p>
          </div>

          {/* Alternatives Cards (Requirement 8) */}
          <div className="space-y-3">
            {alternatives.map((alt, idx) => (
              <div
                key={alt.id || idx}
                id={`alternative-card-${idx}`}
                className="border border-stone-200 hover:border-stone-300 rounded-xl p-4 sm:p-5 bg-white shadow-2xs hover:shadow-xs transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">
                        Option {idx + 1}
                      </span>
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        {alt.distanceFromCurrent} from anchor
                      </span>
                      <span className="text-stone-500 font-medium">
                        {alt.travelTimeFromCurrent}
                      </span>
                      <span className="text-stone-300">•</span>
                      <span className="text-stone-600 font-medium">
                        {alt.durationMinutes} mins
                      </span>
                    </div>

                    <h4 className="text-base sm:text-lg font-bold text-stone-900 pt-0.5">
                      {alt.name}
                    </h4>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                      <span className="flex items-center gap-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-stone-400" />
                        {alt.area}
                      </span>
                      <span className="text-stone-300">•</span>
                      <span className="bg-stone-100 px-2 py-0.5 rounded font-medium">
                        {alt.category}
                      </span>
                    </div>
                  </div>

                  {/* Cost & External Link */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold text-stone-900">
                        {alt.estimatedCost === 0 ? 'Free Entry' : `₹${alt.estimatedCost.toLocaleString('en-IN')}`}
                      </div>
                      <div className="text-[11px] text-stone-500">(Estimated)</div>
                    </div>

                    <a
                      href={alt.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline pt-0.5"
                    >
                      <span>Maps Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Why It Fits Explanation */}
                <div className="bg-stone-50 rounded-lg p-3 text-xs space-y-1.5 border border-stone-100">
                  <div className="text-stone-700 font-semibold flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-stone-500" />
                    <span>Why it fits your itinerary:</span>
                  </div>
                  <p className="text-stone-600 leading-relaxed">
                    {alt.reason}
                  </p>
                  {alt.matchedInterests?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Tag className="w-3 h-3 text-stone-400" />
                      {alt.matchedInterests.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="px-1.5 py-0.5 bg-white border border-stone-200 text-stone-600 text-[10px] rounded font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Approve Button */}
                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    id={`accept-replacement-btn-${idx}`}
                    onClick={() => onAcceptReplacement(alt)}
                    disabled={isApplying}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Accept This Replacement</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Alternative: Skip without replacement */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-stone-800">
                Prefer free leisure time?
              </span>
              <p className="text-xs text-stone-500">
                Skip this activity without adding a replacement. Downstream activities will remain intact.
              </p>
            </div>
            <button
              type="button"
              id="skip-without-replacement-btn"
              onClick={onSkipWithoutReplacement}
              disabled={isApplying}
              className="px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-200 hover:bg-stone-100 rounded-lg transition shrink-0"
            >
              Skip Without Replacement
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
          <span className="text-xs text-stone-400">
            All replanning updates only the affected time slot.
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 text-stone-600 hover:text-stone-900 text-xs font-bold transition"
          >
            Close / Keep Original
          </button>
        </div>
      </div>
    </div>
  );
};

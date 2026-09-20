import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  Calendar,
  Clock,
  ExternalLink,
  Pencil,
  Trash2,
  Sparkles,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Tag,
  Compass,
} from 'lucide-react';
import {
  Trip,
  TripStay,
  ExistingStayDetails,
  StayRecommendation,
  RecommendedStayDetails,
} from '../../types';
import { removeTripStay } from '../../lib/tripService';
import { useAuth } from '../../context/AuthContext';
import { StayModal } from './StayModal';

interface StaySectionProps {
  trip: Trip;
  canEdit: boolean;
  onTripUpdated: (updatedTrip: Trip) => void;
}

export const StaySection: React.FC<StaySectionProps> = ({
  trip,
  canEdit,
  onTripUpdated,
}) => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialMode, setModalInitialMode] = useState<'existing' | 'help_me_find'>('existing');
  const [prefillArea, setPrefillArea] = useState<string | undefined>(undefined);
  const [prefillSuggestedType, setPrefillSuggestedType] = useState<string | undefined>(undefined);

  const [isRemoving, setIsRemoving] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Dynamic recommendations state (if fetching on-demand)
  const [isFetchingRecs, setIsFetchingRecs] = useState(false);
  const [dynamicRecs, setDynamicRecs] = useState<StayRecommendation[] | null>(null);
  const [recError, setRecError] = useState<string | null>(null);

  const currentStay: TripStay | undefined = (trip.stay || trip.planning?.stay) || undefined;
  const existingStay = currentStay?.mode === 'existing' ? (currentStay as ExistingStayDetails) : null;
  const recommendedStay =
    currentStay?.mode === 'help_me_find' ? (currentStay as RecommendedStayDetails) : null;

  // Gather recommendations from itinerary or dynamic state
  const stayRecs: StayRecommendation[] =
    dynamicRecs || trip.itinerary?.stayRecommendations || [];

  const handleOpenEdit = () => {
    setModalInitialMode('existing');
    setPrefillArea(undefined);
    setPrefillSuggestedType(undefined);
    setIsModalOpen(true);
  };

  const handleOpenAdd = (mode: 'existing' | 'help_me_find' = 'existing') => {
    setModalInitialMode(mode);
    setPrefillArea(undefined);
    setPrefillSuggestedType(undefined);
    setIsModalOpen(true);
  };

  const handleSelectRecommendation = (rec: StayRecommendation) => {
    setModalInitialMode('existing');
    setPrefillArea(rec.area);
    setPrefillSuggestedType(rec.suggestedStayType || rec.suggestedType);
    setIsModalOpen(true);
  };

  const handleRemoveStay = async () => {
    if (!user) return;
    try {
      setIsRemoving(true);
      setActionError(null);
      const updatedTrip = await removeTripStay(trip.id, user.uid);
      setIsRemoving(false);
      setRemoveConfirm(false);
      onTripUpdated(updatedTrip);
    } catch (err: unknown) {
      setIsRemoving(false);
      setActionError(err instanceof Error ? err.message : 'Failed to remove accommodation details.');
    }
  };

  const handleFetchRecommendations = async () => {
    try {
      setIsFetchingRecs(true);
      setRecError(null);

      const response = await fetch('/api/stay/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
          dailyBudget: trip.dailyBudget,
          travelStyle: trip.planning?.travelStyle || 'Balanced',
          interests: trip.planning?.interests || ['Sightseeing'],
        }),
      });

      if (!response.ok) {
        throw new Error('Could not fetch stay recommendations at this time.');
      }

      const data = await response.json();
      if (data.status === 'ready' && Array.isArray(data.recommendations)) {
        setDynamicRecs(data.recommendations);
      } else {
        throw new Error('Invalid recommendation response from server.');
      }
      setIsFetchingRecs(false);
    } catch (err: unknown) {
      setIsFetchingRecs(false);
      setRecError(err instanceof Error ? err.message : 'Failed to fetch stay recommendations.');
    }
  };

  return (
    <section id="section-stay" className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#2E5658]" />
            <span>Accommodation &amp; Stay</span>
          </h2>
          <p className="text-xs text-stone-500">
            Anchor location for daily departures, evening returns, and route clustering
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {existingStay ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-edit-stay"
                  onClick={handleOpenEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2E5658] bg-[#EEF4F3] hover:bg-[#D3E2E0] rounded-xl transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Stay</span>
                </button>

                {!removeConfirm ? (
                  <button
                    type="button"
                    id="btn-confirm-remove-stay"
                    onClick={() => setRemoveConfirm(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Remove stay"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-2 py-1 rounded-xl">
                    <span className="text-[11px] text-red-700 font-medium">Remove stay?</span>
                    <button
                      type="button"
                      id="btn-do-remove-stay"
                      onClick={handleRemoveStay}
                      disabled={isRemoving}
                      className="text-[11px] font-bold text-red-700 hover:underline px-1"
                    >
                      {isRemoving ? 'Removing...' : 'Yes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoveConfirm(false)}
                      className="text-[11px] text-stone-500 hover:underline px-1"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                id="btn-add-stay"
                onClick={() => handleOpenAdd('existing')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#2E5658] hover:bg-[#234446] rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Stay</span>
              </button>
            )}
          </div>
        )}
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Case 1: Existing Booked Stay */}
      {existingStay ? (
        <div
          id="existing-stay-card"
          className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 hover:border-stone-300 transition"
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Anchored Accommodation</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-stone-900">
                {existingStay.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-stone-600">
                <MapPin className="w-3.5 h-3.5 text-[#2E5658] shrink-0" />
                <span>{existingStay.address}</span>
              </div>
            </div>

            {/* External Search & Navigation Links */}
            <div className="flex flex-wrap items-center gap-2">
              <a
                id="btn-stay-google-maps"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${existingStay.name} ${existingStay.address} ${trip.destination}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition"
                title="Open location in Google Maps"
              >
                <MapPin className="w-3.5 h-3.5 text-stone-500" />
                <span>View on Maps</span>
                <ExternalLink className="w-3 h-3 text-stone-400" />
              </a>

              <a
                id="btn-stay-google-hotels"
                href={`https://www.google.com/travel/hotels?q=${encodeURIComponent(
                  `${existingStay.name} ${existingStay.address} ${trip.destination}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#2E5658] bg-[#EEF4F3] hover:bg-[#D3E2E0] rounded-xl transition"
                title="Search property details on Google Travel"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Search Details</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Timing Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-stone-100">
            <div className="p-3 bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <Calendar className="w-3.5 h-3.5 text-[#2E5658]" />
                <span>Check-in</span>
              </div>
              <p className="text-xs font-bold text-stone-900">
                {existingStay.checkInDate || trip.startDate}
                <span className="font-medium text-stone-600 ml-1.5">
                  ({existingStay.checkInTime || '14:00'})
                </span>
              </p>
              <span className="text-[10px] text-stone-400 block">Day 1 Itinerary Anchor</span>
            </div>

            <div className="p-3 bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <Calendar className="w-3.5 h-3.5 text-[#2E5658]" />
                <span>Check-out</span>
              </div>
              <p className="text-xs font-bold text-stone-900">
                {existingStay.checkOutDate || trip.endDate}
                <span className="font-medium text-stone-600 ml-1.5">
                  ({existingStay.checkOutTime || '11:00'})
                </span>
              </p>
              <span className="text-[10px] text-stone-400 block">Final Day Departure Anchor</span>
            </div>

            <div className="p-3 bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <Clock className="w-3.5 h-3.5 text-[#2E5658]" />
                <span>Stay Notes</span>
              </div>
              <p className="text-xs font-medium text-stone-800 line-clamp-2">
                {existingStay.bookingNote || 'Anchoring all daily travel clusters around this neighborhood.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Case 2: Recommendations are present or preference set to help_me_find */}
      {stayRecs.length > 0 && (
        <div id="stay-recommendations-container" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-stone-900">
                Recommended Neighborhoods to Stay in {trip.destination}
              </h3>
            </div>
            <span className="text-[11px] text-stone-500">
              Clustered with your daily activities &amp; ₹{trip.dailyBudget.toLocaleString('en-IN')}/day budget
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stayRecs.map((rec, idx) => (
              <div
                key={idx}
                id={`stay-rec-card-${idx}`}
                className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3.5 hover:border-stone-300 transition flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm sm:text-base">
                        {rec.area}
                      </h4>
                      <p className="text-xs text-[#2E5658] font-semibold mt-0.5">
                        {rec.suggestedStayType || rec.suggestedType || 'Recommended Stay Area'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-stone-600">
                    <Tag className="w-3.5 h-3.5 text-stone-400" />
                    <span>{rec.budgetFit}</span>
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed pt-1 border-t border-stone-100">
                    {rec.whyItFits}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                  <a
                    id={`btn-browse-hotels-${idx}`}
                    href={
                      rec.searchDeepLinkUrl ||
                      rec.searchUrl ||
                      `https://www.google.com/travel/hotels?q=${encodeURIComponent(
                        `hotels in ${rec.area} ${trip.destination}`
                      )}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#2E5658] hover:underline"
                  >
                    <span>Browse Hotels</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  {canEdit && (
                    <button
                      type="button"
                      id={`btn-select-stay-area-${idx}`}
                      onClick={() => handleSelectRecommendation(rec)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition"
                    >
                      I booked here
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Case 3: No stay added yet and no recommendations loaded */}
      {!existingStay && stayRecs.length === 0 && (
        <div
          id="no-stay-card"
          className="bg-stone-50 border border-dashed border-stone-200 rounded-2xl p-6 text-center space-y-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-white border border-stone-200 text-stone-500 mx-auto flex items-center justify-center">
            <Building2 className="w-6 h-6 text-[#2E5658]" />
          </div>

          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-sm font-bold text-stone-900">
              No Accommodation Added Yet
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Adding a hotel or stay anchors your daily departure points, ensures seamless transit clustering, and adapts replanning around your exact location.
            </p>
          </div>

          {recError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 max-w-md mx-auto flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{recError}</span>
            </div>
          )}

          {canEdit && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                id="btn-add-booked-stay"
                onClick={() => handleOpenAdd('existing')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#2E5658] hover:bg-[#234446] rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add My Booked Stay</span>
              </button>

              <button
                type="button"
                id="btn-get-stay-recommendations"
                onClick={handleFetchRecommendations}
                disabled={isFetchingRecs}
                className="px-4 py-2 text-xs font-semibold text-stone-800 bg-white border border-stone-300 hover:bg-stone-100 rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isFetchingRecs ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>Get Neighborhood Recommendations</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stay Modal for Add / Edit */}
      {isModalOpen && (
        <StayModal
          isOpen={isModalOpen}
          trip={trip}
          initialMode={modalInitialMode}
          prefillArea={prefillArea}
          prefillSuggestedType={prefillSuggestedType}
          onClose={() => setIsModalOpen(false)}
          onSaved={(updatedTrip) => {
            onTripUpdated(updatedTrip);
          }}
        />
      )}
    </section>
  );
};

import React, { useState } from 'react';
import { X, Building2, MapPin, Calendar, Clock, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Trip, TripStay, ExistingStayDetails } from '../../types';
import { updateTripStay } from '../../lib/tripService';
import { useAuth } from '../../context/AuthContext';

interface StayModalProps {
  isOpen: boolean;
  trip: Trip;
  initialMode?: 'existing' | 'help_me_find';
  prefillArea?: string;
  prefillSuggestedType?: string;
  onClose: () => void;
  onSaved: (updatedTrip: Trip) => void;
}

export const StayModal: React.FC<StayModalProps> = ({
  isOpen,
  trip,
  initialMode,
  prefillArea,
  prefillSuggestedType,
  onClose,
  onSaved,
}) => {
  const { user } = useAuth();
  const currentStay = trip.stay || trip.planning?.stay;
  const isCurrentlyExisting = currentStay?.mode === 'existing';

  const [mode, setMode] = useState<'existing' | 'help_me_find'>(
    initialMode || (isCurrentlyExisting ? 'existing' : 'existing')
  );

  const existingDetails = isCurrentlyExisting ? (currentStay as ExistingStayDetails) : null;

  const [name, setName] = useState(existingDetails?.name || '');
  const [address, setAddress] = useState(
    existingDetails?.address || prefillArea || trip.destination || ''
  );
  const [checkInDate, setCheckInDate] = useState(
    existingDetails?.checkInDate || trip.startDate || ''
  );
  const [checkInTime, setCheckInTime] = useState(existingDetails?.checkInTime || '14:00');
  const [checkOutDate, setCheckOutDate] = useState(
    existingDetails?.checkOutDate || trip.endDate || ''
  );
  const [checkOutTime, setCheckOutTime] = useState(existingDetails?.checkOutTime || '11:00');
  const [bookingNote, setBookingNote] = useState(
    existingDetails?.bookingNote || (prefillSuggestedType ? `Suggested type: ${prefillSuggestedType}` : '')
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('You must be signed in to manage accommodation.');
      return;
    }

    if (mode === 'existing') {
      if (!name.trim()) {
        setError('Please enter the name of the hotel or stay.');
        return;
      }
      if (!address.trim()) {
        setError('Please enter the neighborhood or address.');
        return;
      }
      if (!checkInDate || !checkOutDate) {
        setError('Check-in and Check-out dates are required.');
        return;
      }
      if (checkOutDate < checkInDate) {
        setError('Check-out date cannot be earlier than check-in date.');
        return;
      }

      const stayData: ExistingStayDetails = {
        mode: 'existing',
        name: name.trim(),
        address: address.trim(),
        checkInDate,
        checkInTime: checkInTime || '14:00',
        checkOutDate,
        checkOutTime: checkOutTime || '11:00',
        bookingNote: bookingNote.trim() || undefined,
      };

      try {
        setIsSaving(true);
        const updatedTrip = await updateTripStay(trip.id, stayData, user.uid);
        setIsSaving(false);
        onSaved(updatedTrip);
        onClose();
      } catch (err: unknown) {
        setIsSaving(false);
        setError(err instanceof Error ? err.message : 'Failed to save accommodation details.');
      }
    } else {
      // mode === 'help_me_find'
      const stayData: TripStay = {
        mode: 'help_me_find',
      };

      try {
        setIsSaving(true);
        const updatedTrip = await updateTripStay(trip.id, stayData, user.uid);
        setIsSaving(false);
        onSaved(updatedTrip);
        onClose();
      } catch (err: unknown) {
        setIsSaving(false);
        setError(err instanceof Error ? err.message : 'Failed to set stay preference.');
      }
    }
  };

  return (
    <div
      id="stay-modal-backdrop"
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        id="stay-modal-container"
        className="bg-white border border-stone-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1F2421]">
                {existingDetails ? 'Edit Accommodation' : 'Add Stay / Accommodation'}
              </h2>
              <p className="text-xs text-[#5C6460]">
                Anchor your trip schedule and daily routes in {trip.destination}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-stay-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl text-xs font-semibold">
            <button
              type="button"
              id="tab-stay-existing"
              onClick={() => {
                setMode('existing');
                setError(null);
              }}
              className={`py-2 px-3 rounded-lg transition-all ${
                mode === 'existing'
                  ? 'bg-[#2E5658] text-white shadow-xs'
                  : 'text-[#5C6460] hover:text-[#1F2421]'
              }`}
            >
              I Have a Booked Stay
            </button>
            <button
              type="button"
              id="tab-stay-recommend"
              onClick={() => {
                setMode('help_me_find');
                setError(null);
              }}
              className={`py-2 px-3 rounded-lg transition-all ${
                mode === 'help_me_find'
                  ? 'bg-[#2E5658] text-white shadow-xs'
                  : 'text-[#5C6460] hover:text-[#1F2421]'
              }`}
            >
              Help Me Find Where to Stay
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'existing' ? (
            <>
              {/* Hotel / Stay Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="input-stay-name"
                  className="block text-xs font-semibold text-[#1F2421]"
                >
                  Property / Hotel Name <span className="text-[#CF8A70]">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    id="input-stay-name"
                    type="text"
                    required
                    placeholder="e.g. Heritage Haveli, Zostel, Grand Hyatt"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
                  />
                </div>
              </div>

              {/* Address / Area */}
              <div className="space-y-1.5">
                <label
                  htmlFor="input-stay-address"
                  className="block text-xs font-semibold text-[#1F2421]"
                >
                  Neighborhood / Address <span className="text-[#CF8A70]">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    id="input-stay-address"
                    type="text"
                    required
                    placeholder="e.g. Civil Lines, Old Manali, Baga Beach"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
                  />
                </div>
                <p className="text-[11px] text-[#78716C]">
                  Used as the daily departure anchor and return destination.
                </p>
              </div>

              {/* Check-in Dates & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label
                    htmlFor="input-stay-checkin-date"
                    className="block text-xs font-semibold text-[#1F2421]"
                  >
                    Check-in Date
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      id="input-stay-checkin-date"
                      type="date"
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="input-stay-checkin-time"
                    className="block text-xs font-semibold text-[#1F2421]"
                  >
                    Check-in Time
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      id="input-stay-checkin-time"
                      type="time"
                      value={checkInTime}
                      onChange={(e) => setCheckInTime(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
                    />
                  </div>
                </div>
              </div>

              {/* Check-out Dates & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="input-stay-checkout-date"
                    className="block text-xs font-semibold text-[#1F2421]"
                  >
                    Check-out Date
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      id="input-stay-checkout-date"
                      type="date"
                      min={checkInDate || undefined}
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="input-stay-checkout-time"
                    className="block text-xs font-semibold text-[#1F2421]"
                  >
                    Check-out Time
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      id="input-stay-checkout-time"
                      type="time"
                      value={checkOutTime}
                      onChange={(e) => setCheckOutTime(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label
                  htmlFor="input-stay-notes"
                  className="block text-xs font-semibold text-[#1F2421]"
                >
                  Notes &amp; Details <span className="text-[11px] text-stone-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="input-stay-notes"
                  type="text"
                  placeholder="e.g. Booking ref #4981, Deluxe Mountain View, breakfast included"
                  value={bookingNote}
                  onChange={(e) => setBookingNote(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
                />
              </div>
            </>
          ) : (
            <div className="p-4 bg-[#EEF4F3] border border-[#2E5658]/20 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-[#2E5658] font-bold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>AI Stay Neighborhood Guidance</span>
              </div>
              <p className="text-xs text-[#5C6460] leading-relaxed">
                TravelPilot will analyze your daily activity clusters, budget (₹{trip.dailyBudget.toLocaleString('en-IN')}/day), and {trip.tripType} dynamics to recommend the ideal neighborhoods to stay in {trip.destination}.
              </p>
              <div className="text-[11px] text-[#78716C] border-t border-[#2E5658]/10 pt-2 flex items-center justify-between">
                <span>Direct search deep-links provided via Google Travel Hotels.</span>
                <span className="font-semibold text-[#2E5658]">No hidden booking fees</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
            <button
              type="button"
              id="btn-cancel-stay-modal"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-save-stay-modal"
              disabled={isSaving}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#2E5658] hover:bg-[#234446] rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{mode === 'existing' ? 'Save Accommodation' : 'Request Recommendations'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

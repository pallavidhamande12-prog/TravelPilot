import React, { useState } from 'react';
import { X, Calendar, MapPin, IndianRupee, Users, Compass, AlertCircle } from 'lucide-react';
import { TripType, CreateTripInput } from '../../types';
import { createTrip } from '../../lib/tripService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTripCreated: (tripId: string) => void;
}

export const CreateTripModal: React.FC<CreateTripModalProps> = ({
  isOpen,
  onClose,
  onTripCreated,
}) => {
  const { user, profile } = useAuth();

  const [formData, setFormData] = useState<CreateTripInput>({
    name: '',
    destination: '',
    startDate: '',
    endDate: '',
    dailyBudget: 4000,
    tripType: 'Friends',
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('You must be signed in to create a trip.');
      return;
    }

    // Client-side validations
    if (!formData.name.trim()) {
      setError('Trip name cannot be empty.');
      return;
    }
    if (!formData.destination.trim()) {
      setError('Destination cannot be empty.');
      return;
    }
    if (!formData.startDate) {
      setError('Start date is required.');
      return;
    }
    if (!formData.endDate) {
      setError('End date is required.');
      return;
    }
    if (formData.endDate < formData.startDate) {
      setError('End date cannot be before start date.');
      return;
    }
    if (!formData.dailyBudget || Number(formData.dailyBudget) <= 0) {
      setError('Daily budget must be a positive number.');
      return;
    }
    if (!formData.tripType) {
      setError('Trip type is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const newTrip = await createTrip(
        formData,
        user.uid,
        profile?.displayName || user.displayName || 'Traveler',
        profile?.photoURL || user.photoURL || ''
      );
      setIsSubmitting(false);
      onTripCreated(newTrip.id);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Failed to create trip');
    }
  };

  return (
    <div
      id="create-trip-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/40 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="create-trip-modal"
        className="w-full max-w-lg bg-[#FFFFFF] rounded-2xl border border-[#E8E2D9] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E8E2D9] bg-[#FAF8F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EBF3F5] text-[#0F4C5C] flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1C1917]">Create New Trip</h2>
              <p className="text-xs text-[#57534E]">Set the basic trip parameters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#78716C] hover:text-[#1C1917] p-1.5 rounded-lg hover:bg-[#F4EFEA] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FAF0EC] border border-[#F3D5C8] text-[#C85A32] text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Trip Name */}
          <div className="space-y-1">
            <label htmlFor="trip-name-input" className="block text-xs font-semibold text-[#1C1917]">
              Trip Name <span className="text-[#C85A32]">*</span>
            </label>
            <input
              id="trip-name-input"
              type="text"
              placeholder="e.g., Summer in Kashmir, Goa Beach Retreat"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2 text-sm bg-white border border-[#E8E2D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] focus:border-transparent text-[#1C1917] placeholder:text-[#A8A29E]"
              required
            />
          </div>

          {/* Destination */}
          <div className="space-y-1">
            <label htmlFor="trip-destination-input" className="block text-xs font-semibold text-[#1C1917]">
              Destination <span className="text-[#C85A32]">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
              <input
                id="trip-destination-input"
                type="text"
                placeholder="e.g., Srinagar, Goa, Tokyo, Paris"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-[#E8E2D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] focus:border-transparent text-[#1C1917] placeholder:text-[#A8A29E]"
                required
              />
            </div>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="trip-start-date" className="block text-xs font-semibold text-[#1C1917]">
                Start Date <span className="text-[#C85A32]">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                <input
                  id="trip-start-date"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-[#E8E2D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] focus:border-transparent text-[#1C1917]"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="trip-end-date" className="block text-xs font-semibold text-[#1C1917]">
                End Date <span className="text-[#C85A32]">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                <input
                  id="trip-end-date"
                  type="date"
                  min={formData.startDate || undefined}
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-[#E8E2D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] focus:border-transparent text-[#1C1917]"
                  required
                />
              </div>
            </div>
          </div>

          {/* Daily Budget & Trip Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="trip-budget-input" className="block text-xs font-semibold text-[#1C1917]">
                Daily Budget (INR) <span className="text-[#C85A32]">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                <input
                  id="trip-budget-input"
                  type="number"
                  min="1"
                  step="100"
                  value={formData.dailyBudget}
                  onChange={(e) => setFormData({ ...formData, dailyBudget: Number(e.target.value) })}
                  className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-[#E8E2D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] focus:border-transparent text-[#1C1917]"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#1C1917]">
                Trip Type <span className="text-[#C85A32]">*</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                {(['Solo', 'Couple', 'Friends', 'Family'] as TripType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, tripType: type })}
                    className={`text-xs py-2 px-1 rounded-xl border font-medium transition-all text-center ${
                      formData.tripType === type
                        ? 'bg-[#0F4C5C] text-white border-[#0F4C5C]'
                        : 'bg-[#FAF8F5] text-[#57534E] border-[#E8E2D9] hover:bg-[#F4EFEA]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-[#E8E2D9]">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Trip...' : 'Create Trip'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { joinTripWithCode } from '../../lib/tripService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Trip } from '../../types';

interface JoinTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoined: (tripId: string) => void;
}

export const JoinTripModal: React.FC<JoinTripModalProps> = ({
  isOpen,
  onClose,
  onJoined,
}) => {
  const { user, profile } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ message: string; trip: Trip } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessInfo(null);

    if (!user) {
      setError('You must be signed in to join a trip.');
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter a trip code.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await joinTripWithCode(
        cleanCode,
        user.uid,
        profile?.displayName || user.displayName || 'TravelPilot Member',
        profile?.photoURL || user.photoURL || ''
      );
      setIsSubmitting(false);

      if (result.status === 'already_member') {
        setSuccessInfo({
          message: `You are already a member of "${result.trip.name}".`,
          trip: result.trip,
        });
      } else {
        setSuccessInfo({
          message: `Successfully joined "${result.trip.name}"!`,
          trip: result.trip,
        });
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Invalid trip code. Please check and try again.');
    }
  };

  const handleOpenJoinedTrip = () => {
    if (successInfo) {
      onJoined(successInfo.trip.id);
    }
  };

  return (
    <div
      id="join-trip-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/40 backdrop-blur-xs"
    >
      <div
        id="join-trip-modal"
        className="w-full max-w-md bg-[#FFFFFF] rounded-2xl border border-[#E8E2D9] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E8E2D9] bg-[#FAF8F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EBF3F5] text-[#0F4C5C] flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1C1917]">Join Trip with Code</h2>
              <p className="text-xs text-[#57534E]">Enter the 6-character code shared by the trip organizer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#78716C] hover:text-[#1C1917] p-1.5 rounded-lg hover:bg-[#F4EFEA] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {successInfo ? (
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#EBF3F5] text-[#0F4C5C] flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1C1917]">{successInfo.message}</h3>
                <p className="text-xs text-[#57534E] mt-1">
                  Destination: <span className="font-medium text-[#1C1917]">{successInfo.trip.destination}</span>
                </p>
              </div>

              <div className="pt-3 flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Back to My Trips
                </Button>
                <Button variant="primary" size="sm" onClick={handleOpenJoinedTrip}>
                  Open Trip
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FAF0EC] border border-[#F3D5C8] text-[#C85A32] text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="join-code-input" className="block text-xs font-semibold text-[#1C1917]">
                  Trip Code
                </label>
                <input
                  id="join-code-input"
                  type="text"
                  maxLength={10}
                  placeholder="e.g. FLY74X"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-3 text-center tracking-widest text-lg font-mono uppercase bg-white border border-[#E8E2D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] focus:border-transparent text-[#1C1917] placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:text-[#A8A29E]"
                  autoFocus
                  required
                />
                <p className="text-[11px] text-[#78716C]">
                  Trip codes are uppercase letters and numbers generated when a trip is created.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#E8E2D9]">
                <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSubmitting || !code.trim()}>
                  {isSubmitting ? 'Verifying Code...' : 'Join Trip'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

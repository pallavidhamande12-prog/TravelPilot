import React, { useState, useEffect } from 'react';
import { X, User, Mail, Shield, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, profile, updateDisplayName } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Synchronize initial input value when modal opens or profile changes
  useEffect(() => {
    if (isOpen) {
      setDisplayName(profile?.displayName || user?.displayName || '');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, profile?.displayName, user?.displayName]);

  if (!isOpen) return null;

  const currentEmail = profile?.email || user?.email || 'No email attached';
  const photoURL = profile?.photoURL || user?.photoURL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = displayName.trim();
    if (!trimmed) {
      setError('Display name must not be empty.');
      return;
    }

    try {
      setIsSubmitting(true);
      await updateDisplayName(trimmed);
      setIsSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Failed to update profile name.';
      setError(msg);
    }
  };

  return (
    <div
      id="edit-profile-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="edit-profile-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-modal-title"
        className="w-full max-w-md bg-[#FAF8F5] border border-[#E8E2D9] rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2D9] bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EBF3F5] text-[#0F4C5C] flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="edit-profile-modal-title"
                className="text-base font-semibold text-[#1C1917]"
              >
                Edit Profile
              </h2>
              <p className="text-xs text-[#57534E]">Update your traveler display name</p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-edit-profile"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-[#78716C] hover:text-[#1C1917] p-1.5 rounded-lg hover:bg-[#F4EFEA] transition-colors focus:outline-none"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div
              id="edit-profile-error"
              className="p-3 bg-[#FAF0EC] border border-[#F5D8CE] rounded-xl flex items-start gap-2.5 text-xs text-[#C85A32]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              id="edit-profile-success"
              className="p-3 bg-[#EBF3F5] border border-[#D0E5E8] rounded-xl flex items-center gap-2.5 text-xs text-[#0F4C5C] font-medium"
            >
              <Check className="w-4 h-4 shrink-0 text-[#0F4C5C]" />
              <span>Display name updated successfully!</span>
            </div>
          )}

          {/* Profile Avatar Preview */}
          <div className="flex items-center gap-3.5 pb-2">
            {photoURL ? (
              <img
                src={photoURL}
                alt={displayName || 'Profile preview'}
                className="w-12 h-12 rounded-full object-cover border border-[#E8E2D9]"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#0F4C5C] text-white flex items-center justify-center font-bold text-base">
                {displayName.trim() ? displayName.trim().charAt(0).toUpperCase() : 'T'}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-[#1C1917]">
                {displayName.trim() || 'TravelPilot Member'}
              </p>
              <p className="text-xs text-[#78716C]">{currentEmail}</p>
            </div>
          </div>

          {/* Editable Display Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="input-edit-display-name"
              className="block text-xs font-semibold text-[#1C1917]"
            >
              Display Name <span className="text-[#C85A32]">*</span>
            </label>
            <input
              id="input-edit-display-name"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Pallavi Dhamande"
              maxLength={60}
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E8E2D9] rounded-xl text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] focus:border-transparent transition-all"
            />
            <p className="text-[11px] text-[#78716C]">
              This name will be shown to your fellow trip members and collaborators.
            </p>
          </div>

          {/* Read-only Email Address */}
          <div className="space-y-1.5">
            <label
              htmlFor="input-readonly-email"
              className="block text-xs font-semibold text-[#78716C]"
            >
              Email Address <span className="text-[11px] font-normal">(Read-only)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A8A29E]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="input-readonly-email"
                type="email"
                readOnly
                disabled
                value={currentEmail}
                className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-[#F4EFEA] border border-[#E8E2D9] rounded-xl text-[#57534E] cursor-not-allowed select-none"
              />
            </div>
            <p className="text-[11px] text-[#A8A29E]">
              Email address is managed by your Google Authentication account and cannot be changed here.
            </p>
          </div>

          {/* Read-only Auth Provider & Security Identity */}
          <div className="p-3 bg-[#F4EFEA] border border-[#E8E2D9] rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[#57534E]">
              <Shield className="w-3.5 h-3.5 text-[#0F4C5C]" />
              <span>Authentication Provider: <strong>Google Sign-In</strong></span>
            </div>
            <span className="text-[10px] text-[#78716C] bg-white px-2 py-0.5 rounded border border-[#E8E2D9]">
              Verified
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E8E2D9]">
            <Button
              type="button"
              id="btn-cancel-edit-profile"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              id="btn-save-edit-profile"
              variant="primary"
              disabled={isSubmitting || !displayName.trim()}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

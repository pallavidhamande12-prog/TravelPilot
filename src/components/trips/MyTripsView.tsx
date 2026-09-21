import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  KeyRound,
  Plus,
  RefreshCw,
  FolderOpen,
  Search,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { UserTrip } from '../../types';
import { getUserTrips, deleteTrip, updateTripName } from '../../lib/tripService';
import { useAuth } from '../../context/AuthContext';
import { TripCard } from './TripCard';
import { CreateTripModal } from './CreateTripModal';
import { JoinTripModal } from './JoinTripModal';
import { Button } from '../ui/Button';

interface MyTripsViewProps {
  onOpenTrip: (tripId: string) => void;
  onNavigatePlan: (tripId?: string) => void;
  onNavigateSurprise: () => void;
}

type FilterTab = 'all' | 'upcoming' | 'active' | 'past';

export const MyTripsView: React.FC<MyTripsViewProps> = ({
  onOpenTrip,
  onNavigatePlan,
  onNavigateSurprise,
}) => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<UserTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Trip Name Edit Modal State
  const [editingTrip, setEditingTrip] = useState<UserTrip | null>(null);
  const [newName, setNewName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [editNameError, setEditNameError] = useState<string | null>(null);

  // Trip Deletion Modal State
  const [deletingTrip, setDeletingTrip] = useState<UserTrip | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchTrips = useCallback(async (showIndicator = false) => {
    if (!user) return;
    try {
      if (showIndicator) setIsRefreshing(true);
      const data = await getUserTrips(user.uid);
      setTrips(data);
    } catch (err) {
      console.error('Failed to load trips:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleTripCreated = (newTripId: string) => {
    setCreateModalOpen(false);
    fetchTrips();
    onNavigatePlan(newTripId);
  };

  const handlePlanTripClick = () => {
    onNavigatePlan();
  };

  // Open Edit Name Modal
  const handleOpenEditName = (trip: UserTrip) => {
    setEditingTrip(trip);
    setNewName(trip.name);
    setEditNameError(null);
  };

  // Save Trip Name
  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingTrip) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      setEditNameError('Trip name cannot be empty.');
      return;
    }
    try {
      setIsSavingName(true);
      setEditNameError(null);
      await updateTripName(editingTrip.id, trimmed, user.uid);
      setEditingTrip(null);
      await fetchTrips();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update trip name';
      setEditNameError(message);
    } finally {
      setIsSavingName(false);
    }
  };

  // Open Delete Confirmation Modal
  const handleOpenDelete = (trip: UserTrip) => {
    setDeletingTrip(trip);
    setDeleteError(null);
  };

  // Confirm Delete Trip
  const handleConfirmDelete = async () => {
    if (!user || !deletingTrip) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteTrip(deletingTrip.id, user.uid);
      setDeletingTrip(null);
      await fetchTrips();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete trip';
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered trips
  const filteredTrips = useMemo(() => {
    const now = new Date();
    return trips.filter((t) => {
      // Search matching
      const matchesSearch =
        !searchQuery.trim() ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.destination.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Status/Tab matching
      if (activeFilter === 'all') return true;
      if (activeFilter === 'active') return t.status === 'Active';
      if (activeFilter === 'upcoming') {
        return (
          t.status !== 'Completed' &&
          (!t.endDate || new Date(t.startDate) >= now || t.status === 'Planning')
        );
      }
      if (activeFilter === 'past') {
        return t.status === 'Completed' || (t.endDate && new Date(t.endDate) < now);
      }
      return true;
    });
  }, [trips, activeFilter, searchQuery]);

  return (
    <div id="my-trips-page-container" className="space-y-8 animate-in fade-in duration-150">
      {/* 1. Header & Actions */}
      <section id="my-trips-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 id="my-trips-title" className="text-3xl font-bold tracking-tight text-[#1F2421]">
            My Trips
          </h1>
          <p id="my-trips-subtitle" className="text-sm text-[#5C6460] mt-1">
            Organize, monitor, and adapt all your journeys in one place.
          </p>
        </div>

        <div id="my-trips-actions-bar" className="flex flex-wrap items-center gap-2.5">
          <Button
            id="btn-join-code"
            variant="outline"
            size="sm"
            onClick={() => setJoinModalOpen(true)}
            icon={<KeyRound className="w-3.5 h-3.5" />}
          >
            Join with Code
          </Button>

          <Button
            id="btn-surprise-me"
            variant="outline"
            size="sm"
            onClick={onNavigateSurprise}
            icon={<Sparkles className="w-3.5 h-3.5 text-[#CF8A70]" />}
          >
            Surprise Me
          </Button>

          <Button
            id="btn-plan-trip"
            variant="primary"
            size="sm"
            onClick={handlePlanTripClick}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Plan New Trip
          </Button>
        </div>
      </section>

      {/* 2. Filter Tabs & Search Filter Bar */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E8E2D9]">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#FAF7F2] border border-[#E8E2D9] rounded-full overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'active', label: 'Active' },
              { id: 'past', label: 'Past' },
            ] as const
          ).map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                id={`filter-tab-${tab.id}`}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#2E5658] text-white shadow-2xs'
                    : 'text-[#5C6460] hover:text-[#1F2421]'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by trip or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#E8E2D9] rounded-full text-xs text-[#1F2421] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#2E5658]/30"
            />
          </div>

          <button
            type="button"
            onClick={() => fetchTrips(true)}
            disabled={isRefreshing}
            className="p-1.5 rounded-full text-[#5C6460] hover:text-[#2E5658] hover:bg-[#FAF7F2] border border-[#E8E2D9] transition-colors"
            title="Refresh trips"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </section>

      {/* 3. Trips Content Area */}
      <section id="my-trips-list-section">
        {loading ? (
          <div id="trips-loading-skeleton" className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-6 h-6 border-2 border-[#2E5658] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-[#5C6460]">Loading your trips...</p>
          </div>
        ) : filteredTrips.length === 0 ? (
          /* Empty State */
          <div
            id="empty-trips-card"
            className="p-10 sm:p-14 text-center max-w-lg mx-auto rounded-2xl bg-white border border-[#E8E2D9] space-y-5"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#FAF7F2] border border-[#E8E2D9] text-[#2E5658] flex items-center justify-center mx-auto shadow-2xs">
              <FolderOpen className="w-7 h-7" />
            </div>

            <div className="space-y-1.5 max-w-sm mx-auto">
              <h2 className="text-lg font-bold text-[#1F2421]">
                {searchQuery ? 'No matching trips found' : 'No trips yet'}
              </h2>
              <p className="text-xs text-[#5C6460] leading-relaxed">
                {searchQuery
                  ? 'Try a different search query or clear the filter.'
                  : 'Create your first trip or join an existing trip with a code.'}
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
              <Button
                id="btn-empty-plan"
                variant="primary"
                size="sm"
                onClick={() => onNavigatePlan()}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Plan a Trip
              </Button>
              <Button
                id="btn-empty-surprise"
                variant="outline"
                size="sm"
                onClick={onNavigateSurprise}
                icon={<Sparkles className="w-3.5 h-3.5 text-[#CF8A70]" />}
              >
                Surprise Me
              </Button>
            </div>
          </div>
        ) : (
          /* Trips Grid */
          <div
            id="trips-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredTrips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onOpen={onOpenTrip}
                onPlan={onNavigatePlan}
                onEditName={handleOpenEditName}
                onRequestDelete={handleOpenDelete}
              />
            ))}
          </div>
        )}
      </section>

      {/* Modals */}
      <CreateTripModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onTripCreated={handleTripCreated}
      />

      <JoinTripModal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        onJoined={(joinedId: string) => {
          setJoinModalOpen(false);
          fetchTrips();
          onOpenTrip(joinedId);
        }}
      />

      {/* Edit Trip Name Modal */}
      {editingTrip && (
        <div
          id="modal-edit-trip-name"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white border border-[#E8E2D9] rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#1F2421]">Edit Trip Name</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTrip(null)}
                className="p-1 rounded-lg text-[#78716C] hover:text-[#1F2421] hover:bg-[#FAF7F2]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveName} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="edit-trip-name-input" className="block text-xs font-semibold text-[#5C6460]">
                  Trip Name
                </label>
                <input
                  id="edit-trip-name-input"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Summer in Kyoto"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658]/30"
                  autoFocus
                  required
                />
              </div>

              {editNameError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                  {editNameError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  id="btn-cancel-edit-name"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTrip(null)}
                  disabled={isSavingName}
                >
                  Cancel
                </Button>
                <Button
                  id="btn-save-edit-name"
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSavingName || !newName.trim()}
                  icon={
                    isSavingName ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )
                  }
                >
                  {isSavingName ? 'Saving...' : 'Save Name'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Trip Confirmation Modal */}
      {deletingTrip && (
        <div
          id="modal-delete-trip-mytrips"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white border border-[#E8E2D9] rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1F2421]">Delete &ldquo;{deletingTrip.name}&rdquo;?</h3>
                <p className="text-xs text-[#5C6460] mt-0.5">
                  This will permanently delete this trip and its itinerary. This action cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                id="btn-cancel-delete-mytrips"
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingTrip(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <button
                type="button"
                id="btn-confirm-delete-mytrips"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-semibold transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Trip</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

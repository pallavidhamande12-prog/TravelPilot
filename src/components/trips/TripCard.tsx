import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Shield,
  Users,
  ArrowRight,
  Sparkles,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { UserTrip, TripMemberRole, TripStatus } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface TripCardProps {
  trip: UserTrip;
  onOpen: (tripId: string) => void;
  onPlan?: (tripId: string) => void;
  onEditName?: (trip: UserTrip) => void;
  onRequestDelete?: (trip: UserTrip) => void;
}

function formatDateRange(startDateStr: string, endDateStr: string): string {
  try {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${start.toLocaleDateString(undefined, options)} – ${end.toLocaleDateString(undefined, options)}`;
  } catch {
    return `${startDateStr} – ${endDateStr}`;
  }
}

function getRoleBadgeVariant(role: TripMemberRole): 'teal' | 'neutral' | 'terracotta' {
  switch (role) {
    case 'admin':
      return 'teal';
    case 'co-admin':
      return 'neutral';
    case 'member':
    default:
      return 'neutral';
  }
}

function getStatusBadge(status: TripStatus) {
  switch (status) {
    case 'Active':
      return <Badge variant="teal">Active</Badge>;
    case 'Completed':
      return <Badge variant="neutral">Completed</Badge>;
    case 'Planning':
    default:
      return <Badge variant="neutral">Planning</Badge>;
  }
}

export const TripCard: React.FC<TripCardProps> = ({
  trip,
  onOpen,
  onPlan,
  onEditName,
  onRequestDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const canEdit = trip.userRole === 'admin' || trip.userRole === 'co-admin';
  const canDelete = trip.userRole === 'admin';

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <Card
      id={`trip-card-${trip.id}`}
      variant="surface"
      className="group hover:border-[#2E5658] hover:shadow-md transition-all flex flex-col justify-between p-6 rounded-2xl relative"
    >
      <div className="space-y-4">
        {/* Header row: Status, Role, and ⋯ Action Menu */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {getStatusBadge(trip.status)}
            {trip.planning && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#2E5658] bg-[#EEF4F3] px-2 py-0.5 rounded-full border border-[#D3E2E0]">
                <Sparkles className="w-2.5 h-2.5 text-[#CF8A70]" />
                Custom Plan
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Badge
              variant={getRoleBadgeVariant(trip.userRole)}
              icon={<Shield className="w-3 h-3" />}
              className="capitalize"
            >
              {trip.userRole}
            </Badge>

            {/* ⋯ Three-Dot Management Menu */}
            {(onEditName || onRequestDelete) && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  id={`trip-menu-btn-${trip.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((prev) => !prev);
                  }}
                  className="p-1.5 rounded-full text-[#78716C] hover:text-[#1F2421] hover:bg-[#FAF7F2] transition-colors focus:outline-none cursor-pointer"
                  title="Trip actions"
                  aria-label="Trip actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {menuOpen && (
                  <div
                    id={`trip-dropdown-${trip.id}`}
                    className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white border border-[#E8E2D9] shadow-lg py-1.5 z-20 text-xs text-[#1F2421] animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      id={`menu-open-trip-${trip.id}`}
                      onClick={() => {
                        setMenuOpen(false);
                        onOpen(trip.id);
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-[#FAF7F2] flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#2E5658]" />
                      <span>Open Trip</span>
                    </button>

                    {canEdit && onEditName && (
                      <button
                        type="button"
                        id={`menu-edit-name-${trip.id}`}
                        onClick={() => {
                          setMenuOpen(false);
                          onEditName(trip);
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-[#FAF7F2] flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#2E5658]" />
                        <span>Edit Trip Name</span>
                      </button>
                    )}

                    {canDelete && onRequestDelete && (
                      <>
                        <div className="my-1 border-t border-[#E8E2D9]" />
                        <button
                          type="button"
                          id={`menu-delete-trip-${trip.id}`}
                          onClick={() => {
                            setMenuOpen(false);
                            onRequestDelete(trip);
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-red-50 text-red-600 flex items-center gap-2 font-medium cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Trip</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Clickable Area to Open Trip */}
        <div onClick={() => onOpen(trip.id)} className="cursor-pointer space-y-3">
          {/* Trip Name & Destination */}
          <div>
            <h3 className="text-lg font-bold text-[#1F2421] group-hover:text-[#2E5658] transition-colors leading-tight">
              {trip.name}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-[#5C6460] mt-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#2E5658] shrink-0" />
              <span className="truncate">{trip.destination}</span>
            </div>
          </div>

          {/* Details: Dates, Budget, Trip Type */}
          <div className="space-y-1.5 pt-3 border-t border-[#E8E2D9] text-xs text-[#5C6460]">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
              <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="flex items-center gap-1 text-[#78716C]">
                <Users className="w-3.5 h-3.5" />
                <span>{trip.tripType}</span>
              </span>
              <span className="font-semibold text-[#1F2421]">
                ₹{trip.dailyBudget.toLocaleString('en-IN')}/day
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Action footer */}
      <div className="mt-5 pt-3.5 border-t border-[#E8E2D9] flex items-center justify-between text-xs font-semibold">
        {onPlan && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlan(trip.id);
            }}
            className="text-[#2E5658] hover:text-[#234547] flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-[#CF8A70]" />
            <span>{trip.planning ? 'Trip Itinerary' : 'Plan Trip'}</span>
          </button>
        )}
        <div
          onClick={() => onOpen(trip.id)}
          className="ml-auto flex items-center gap-1 text-[#2E5658] group-hover:text-[#234547] cursor-pointer"
        >
          <span>Open Trip</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Card>
  );
};

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  IndianRupee,
  Sparkles,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  AlertCircle,
  Trees,
  Utensils,
  ShoppingBag,
  Landmark,
  Moon,
  Coffee,
  Camera,
  Star,
  Gem,
  Flame,
  ChevronRight,
  Sliders,
  Building2,
  ArrowRight,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import {
  Trip,
  TripType,
  TravelInterest,
  TravelStyle,
  TripPlanningParameters,
  TripItinerary,
  UserTrip,
  TripMemberRole,
  TripStay,
} from '../../types';
import { getTripDetails, saveTripPlanningParameters, saveTripItinerary, getUserTrips, createTrip } from '../../lib/tripService';
import { generatePlan } from '../../services/planner';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ItineraryView } from '../itinerary/ItineraryView';
import { AILoadingScreen } from '../itinerary/AILoadingScreen';

interface PlanTripViewProps {
  initialTripId?: string | null;
  onBack: () => void;
  onOpenTrip: (tripId: string) => void;
  onCreateNewTrip: () => void;
}

const INTEREST_OPTIONS: Array<{
  id: TravelInterest;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  { id: 'Nature', label: 'Nature', icon: Trees, description: 'Parks, scenic landscapes, hills & gardens' },
  { id: 'Adventure', label: 'Adventure', icon: Flame, description: 'Trekking, water sports & outdoor thrills' },
  { id: 'Food', label: 'Food', icon: Utensils, description: 'Street food, culinary hotspots & local cafes' },
  { id: 'Shopping', label: 'Shopping', icon: ShoppingBag, description: 'Local bazaars, handicrafts & modern malls' },
  { id: 'History & Culture', label: 'History & Culture', icon: Landmark, description: 'Heritage monuments, temples & museums' },
  { id: 'Nightlife', label: 'Nightlife', icon: Moon, description: 'Live music, evening lounges & vibrant clubs' },
  { id: 'Relaxation', label: 'Relaxation', icon: Coffee, description: 'Leisurely strolls, spas & peaceful corners' },
  { id: 'Photography', label: 'Photography', icon: Camera, description: 'Iconic viewpoints, architecture & sunsets' },
  { id: 'Hidden Gems', label: 'Hidden Gems', icon: Gem, description: 'Offbeat paths, secluded cafes & secrets' },
  { id: 'Popular Attractions', label: 'Popular Attractions', icon: Star, description: 'Must-visit landmarks & signature spots' },
];

const TRAVEL_STYLES: Array<{
  id: TravelStyle;
  label: string;
  badge: string;
  activitiesPerDay: string;
  description: string;
}> = [
  {
    id: 'Relaxed',
    label: 'Relaxed',
    badge: '1–2 stops / day',
    activitiesPerDay: 'Slow pace with ample downtime',
    description: 'Unrushed mornings, generous coffee breaks, and minimal transfers between neighborhoods.',
  },
  {
    id: 'Balanced',
    label: 'Balanced',
    badge: '2–3 stops / day',
    activitiesPerDay: 'Optimized sightseeing with breathing room',
    description: 'A harmonious blend of signature highlights, relaxed meals, and scenic walks.',
  },
  {
    id: 'Packed',
    label: 'Packed',
    badge: '4+ stops / day',
    activitiesPerDay: 'High-energy coverage from dawn to dusk',
    description: 'Maximize every hour to see everything the destination has to offer.',
  },
];

const SAMPLE_DESTINATIONS = [
  { city: 'Manali', region: 'Old Manali & Solang Valley', origin: 'Delhi' },
  { city: 'Goa', region: 'North Goa beaches & Fontainhas', origin: 'Pune' },
  { city: 'Tokyo', region: 'Asakusa, Shinjuku & Shibuya', origin: 'Mumbai' },
  { city: 'Kerala', region: 'Munnar & Alleppey Backwaters', origin: 'Bengaluru' },
  { city: 'Jaipur', region: 'Pink City & Amer', origin: 'Delhi' },
  { city: 'Paris', region: 'Latin Quarter & Montmartre', origin: '' },
];

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

function calculateDays(startDateStr: string, endDateStr: string): number {
  try {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return isNaN(diffDays) || diffDays <= 0 ? 1 : diffDays;
  } catch {
    return 1;
  }
}

const WIZARD_STEPS = [
  { step: 1, title: 'Destination', shortDesc: 'Where & Origin' },
  { step: 2, title: 'Dates & Budget', shortDesc: 'Duration & Daily Target' },
  { step: 3, title: 'Travellers & Style', shortDesc: 'Group & Pacing' },
  { step: 4, title: 'Preferences', shortDesc: 'Interests & Vibe' },
  { step: 5, title: 'Accommodation', shortDesc: 'Stay Details' },
  { step: 6, title: 'Review & Generate', shortDesc: 'Final Validation' },
];

export const PlanTripView: React.FC<PlanTripViewProps> = ({
  initialTripId,
  onBack,
  onOpenTrip,
  onCreateNewTrip,
}) => {
  const { user } = useAuth();

  // Wizard current step: 1 to 6
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Available trips for planning
  const [availableTrips, setAvailableTrips] = useState<UserTrip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(initialTripId || null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [userRole, setUserRole] = useState<TripMemberRole>('member');
  const [loadingTrip, setLoadingTrip] = useState(true);

  // Form Field States
  const [tripName, setTripName] = useState<string>('');
  const [origin, setOrigin] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [travelers, setTravelers] = useState<number>(1);
  const [tripType, setTripType] = useState<TripType>('Solo');
  const [dailyBudget, setDailyBudget] = useState<number>(3000);
  const [interests, setInterests] = useState<TravelInterest[]>(['Popular Attractions', 'Food']);
  const [travelStyle, setTravelStyle] = useState<TravelStyle>('Balanced');

  // Advanced toggles
  const [preferPopular, setPreferPopular] = useState<boolean>(true);
  const [preferHiddenGems, setPreferHiddenGems] = useState<boolean>(false);
  const [preferPlacesCloseTogether, setPreferPlacesCloseTogether] = useState<boolean>(true);
  const [minimizeTravelTime, setMinimizeTravelTime] = useState<boolean>(true);
  const [preferLowerCost, setPreferLowerCost] = useState<boolean>(false);

  // Stay / Accommodation State
  const [stayMode, setStayMode] = useState<'none' | 'existing' | 'help_me_find'>('none');
  const [stayName, setStayName] = useState<string>('');
  const [stayAddress, setStayAddress] = useState<string>('');
  const [stayCheckInDate, setStayCheckInDate] = useState<string>('');
  const [stayCheckInTime, setStayCheckInTime] = useState<string>('14:00');
  const [stayCheckOutDate, setStayCheckOutDate] = useState<string>('');
  const [stayCheckOutTime, setStayCheckOutTime] = useState<string>('11:00');
  const [stayBookingNote, setStayBookingNote] = useState<string>('');

  // Generation & Status States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorType, setFormErrorType] = useState<'validation' | 'generation' | null>(null);

  // Generated Itinerary
  const [activeItinerary, setActiveItinerary] = useState<TripItinerary | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);

  // 1. Fetch available trips for the user (for reference or manual switching if editing)
  useEffect(() => {
    let isMounted = true;
    async function loadTrips() {
      if (!user) return;
      try {
        const list = await getUserTrips(user.uid);
        if (isMounted) {
          setAvailableTrips(list);
          // Crucial: NEVER auto-select an existing trip here!
          // "Plan a Trip" must always start a clean new trip flow unless initialTripId was provided.
        }
      } catch {
        // silent
      }
    }
    loadTrips();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // 2. Load active trip details and prefill existing planning parameters ONLY if activeTripId was provided
  useEffect(() => {
    let isMounted = true;
    async function loadActiveTrip() {
      if (!activeTripId || !user) {
        setLoadingTrip(false);
        return;
      }
      try {
        setLoadingTrip(true);
        const { trip: tripData, userRole: role } = await getTripDetails(activeTripId, user.uid);
        if (isMounted && tripData) {
          setTrip(tripData);
          setUserRole(role);
          setTripName(tripData.name || '');

          if (tripData.itinerary) {
            setActiveItinerary(tripData.itinerary);
          }

          if (tripData.planning) {
            const p = tripData.planning;
            setOrigin(p.origin || '');
            setDestination(p.destination || tripData.destination || '');
            setRegion(p.region || '');
            setStartDate(p.startDate || tripData.startDate || '');
            setEndDate(p.endDate || tripData.endDate || '');
            setTravelers(p.travelers || 1);
            setTripType(p.tripType || tripData.tripType || 'Solo');
            setDailyBudget(p.dailyBudget || tripData.dailyBudget || 3000);
            setInterests(p.interests || ['Popular Attractions']);
            setTravelStyle(p.travelStyle || 'Balanced');
            setPreferPopular(p.preferPopular ?? true);
            setPreferHiddenGems(p.preferHiddenGems ?? false);
            setPreferPlacesCloseTogether(p.preferPlacesCloseTogether ?? true);
            setMinimizeTravelTime(p.minimizeTravelTime ?? true);
            setPreferLowerCost(p.preferLowerCost ?? false);

            if (p.stay) {
              setStayMode(p.stay.mode || 'none');
              if (p.stay.mode === 'existing') {
                setStayName(p.stay.name || '');
                setStayAddress(p.stay.address || '');
                setStayCheckInDate(p.stay.checkInDate || '');
                setStayCheckInTime(p.stay.checkInTime || '14:00');
                setStayCheckOutDate(p.stay.checkOutDate || '');
                setStayCheckOutTime(p.stay.checkOutTime || '11:00');
                setStayBookingNote(p.stay.bookingNote || '');
              }
            } else if (tripData.stay && tripData.stay.mode === 'existing') {
              setStayMode('existing');
              setStayName(tripData.stay.name || '');
              setStayAddress(tripData.stay.address || '');
              setStayCheckInDate(tripData.stay.checkInDate || '');
              setStayCheckOutDate(tripData.stay.checkOutDate || '');
              setStayBookingNote(tripData.stay.bookingNote || '');
            } else if (tripData.stay && tripData.stay.mode === 'help_me_find') {
              setStayMode('help_me_find');
            }
          } else {
            setDestination(tripData.destination || '');
            setStartDate(tripData.startDate || '');
            setEndDate(tripData.endDate || '');
            setTripType(tripData.tripType || 'Solo');
            setDailyBudget(tripData.dailyBudget || 3000);
            if (tripData.stay && tripData.stay.mode === 'existing') {
              setStayMode('existing');
              setStayName(tripData.stay.name || '');
              setStayAddress(tripData.stay.address || '');
              setStayCheckInDate(tripData.stay.checkInDate || '');
              setStayCheckOutDate(tripData.stay.checkOutDate || '');
              setStayBookingNote(tripData.stay.bookingNote || '');
            } else if (tripData.stay && tripData.stay.mode === 'help_me_find') {
              setStayMode('help_me_find');
            }
          }
          setLoadingTrip(false);
        }
      } catch {
        if (isMounted) setLoadingTrip(false);
      }
    }
    loadActiveTrip();
    return () => {
      isMounted = false;
    };
  }, [activeTripId, user]);

  const handleInterestToggle = (id: TravelInterest) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleTravelersChange = (newCount: number) => {
    const valid = Math.max(1, Math.min(20, newCount));
    setTravelers(valid);
    if (valid === 1) setTripType('Solo');
    else if (valid === 2 && tripType === 'Solo') setTripType('Couple');
    else if (valid > 2 && (tripType === 'Solo' || tripType === 'Couple')) setTripType('Friends');
  };

  // Step Validation logic
  const validateStep = (stepNumber: number): boolean => {
    setFormError(null);
    setFormErrorType(null);

    if (stepNumber === 1) {
      if (!destination.trim()) {
        setFormErrorType('validation');
        setFormError('Destination / City is required.');
        return false;
      }
    } else if (stepNumber === 2) {
      if (!startDate || !endDate) {
        setFormErrorType('validation');
        setFormError('Both start and end dates are required.');
        return false;
      }
      if (endDate < startDate) {
        setFormErrorType('validation');
        setFormError('End date cannot be earlier than start date.');
        return false;
      }
      if (!dailyBudget || dailyBudget <= 0) {
        setFormErrorType('validation');
        setFormError('Daily budget must be a positive number in INR.');
        return false;
      }
    } else if (stepNumber === 3) {
      if (travelers < 1) {
        setFormErrorType('validation');
        setFormError('Must have at least 1 traveler.');
        return false;
      }
    } else if (stepNumber === 4) {
      if (interests.length === 0) {
        setFormErrorType('validation');
        setFormError('Please select at least one travel interest.');
        return false;
      }
    } else if (stepNumber === 5) {
      if (stayMode === 'existing' && !stayName.trim()) {
        setFormErrorType('validation');
        setFormError('Please enter your hotel or stay name (or select "No Stay Yet").');
        return false;
      }
    }
    return true;
  };

  const goToNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(6, prev + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPrevStep = () => {
    setFormError(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Central submission handler
  const handleGeneratePlan = async () => {
    // Run all validations
    for (let s = 1; s <= 5; s++) {
      if (!validateStep(s)) {
        setCurrentStep(s);
        return;
      }
    }

    let stayPayload: TripStay | null = null;
    if (stayMode === 'existing') {
      stayPayload = {
        mode: 'existing',
        name: stayName.trim(),
        address: stayAddress.trim() || destination.trim(),
        checkInDate: stayCheckInDate || startDate,
        checkInTime: stayCheckInTime || '14:00',
        checkOutDate: stayCheckOutDate || endDate,
        checkOutTime: stayCheckOutTime || '11:00',
        bookingNote: stayBookingNote.trim() || undefined,
      };
    } else if (stayMode === 'help_me_find') {
      stayPayload = {
        mode: 'help_me_find',
      };
    }

    const planningPayload: TripPlanningParameters = {
      origin: origin.trim() || undefined,
      destination: destination.trim(),
      region: region.trim(),
      startDate,
      endDate,
      travelers: Number(travelers),
      tripType,
      dailyBudget: Number(dailyBudget),
      interests,
      travelStyle,
      preferPopular,
      preferHiddenGems,
      preferPlacesCloseTogether,
      minimizeTravelTime,
      preferLowerCost,
      stay: stayPayload,
    };

    try {
      setIsSubmitting(true);
      setIsGenerating(true);

      let targetTripId = activeTripId;

      // If this is a fresh planning flow (no trip container yet), create the trip in Firestore
      if (!targetTripId) {
        if (!user) {
          setFormErrorType('validation');
          setFormError('Please sign in to plan and save your trip.');
          setIsSubmitting(false);
          setIsGenerating(false);
          return;
        }

        const finalTripName =
          tripName.trim() ||
          `${destination.trim()} ${
            tripType === 'Solo'
              ? 'Solo Trip'
              : tripType === 'Couple'
              ? 'Getaway'
              : tripType === 'Family'
              ? 'Family Vacation'
              : 'Adventure'
          }`;

        const createdTrip = await createTrip(
          {
            name: finalTripName,
            destination: destination.trim(),
            startDate,
            endDate,
            dailyBudget: Number(dailyBudget),
            tripType,
            stay: stayPayload || undefined,
          },
          user.uid,
          user.displayName || 'Traveler',
          user.photoURL || ''
        );

        targetTripId = createdTrip.id;
        setActiveTripId(createdTrip.id);
        setTrip(createdTrip);
      }

      // 1. Save planning parameters
      const updatedTrip = await saveTripPlanningParameters(targetTripId, planningPayload);
      setTrip(updatedTrip);

      // 2. Call central planning engine (Gemini AI server-side)
      const planResult = await generatePlan({
        mode: 'initial',
        tripId: targetTripId,
        destination: planningPayload.destination,
        startDate: planningPayload.startDate,
        endDate: planningPayload.endDate,
        planning: planningPayload,
      });

      if (planResult.status === 'ready' && planResult.itinerary) {
        // 3. Persist generated itinerary into Firestore under trips/{tripId}.itinerary
        const tripWithItinerary = await saveTripItinerary(targetTripId, planResult.itinerary);
        setTrip(tripWithItinerary);
        setActiveItinerary(planResult.itinerary);
        setShowEditForm(false);
        setIsGenerating(false);
        setIsSubmitting(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setIsGenerating(false);
        setIsSubmitting(false);
        setFormErrorType('generation');
        setFormError(
          planResult.message ||
            "TravelPilot couldn't gather enough reliable information for this destination right now. Please try again."
        );
      }
    } catch (err: unknown) {
      setIsGenerating(false);
      setIsSubmitting(false);
      setFormErrorType('generation');
      setFormError(
        err instanceof Error
          ? err.message
          : "TravelPilot couldn't gather enough reliable information for this destination right now. Please try again."
      );
    }
  };

  // If loading an existing trip
  if (loadingTrip && initialTripId) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-[#5C6460]">
        <div className="w-5 h-5 border-2 border-[#2E5658] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading trip details...</p>
      </div>
    );
  }

  // 1. Loading screen while AI is actively planning the itinerary
  if (isGenerating) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <AILoadingScreen
          destination={destination || trip?.destination || 'your destination'}
          travelStyle={travelStyle}
        />
      </div>
    );
  }

  // 2. Completed itinerary view
  if (activeItinerary && !showEditForm && trip) {
    return (
      <div id="plan-trip-itinerary-container" className="max-w-4xl mx-auto space-y-6 py-6 animate-in fade-in duration-150">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onBack} icon={<ArrowLeft className="w-3.5 h-3.5" />}>
            Back to Dashboard
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditForm(true)}
              icon={<Sliders className="w-3.5 h-3.5" />}
            >
              Adjust Preferences
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onOpenTrip(trip.id)}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Open Trip Details
            </Button>
          </div>
        </div>

        <ItineraryView
          trip={trip}
          itinerary={activeItinerary}
          userRole={userRole}
          onEditPreferences={() => setShowEditForm(true)}
          onBackToOverview={() => onOpenTrip(trip.id)}
          onReplan={() => handleGeneratePlan()}
          isReplanning={isGenerating}
          onUpdateItinerary={(updated) => setActiveItinerary(updated)}
          onUpdateTripName={(newName) => {
            setTrip((prev) => (prev ? { ...prev, name: newName } : null));
            setAvailableTrips((prev) =>
              prev.map((t) => (t.id === trip.id ? { ...t, name: newName } : t))
            );
          }}
        />
      </div>
    );
  }

  // Days calculation for current form
  const currentDays = startDate && endDate ? calculateDays(startDate, endDate) : 1;

  return (
    <div id="plan-trip-form-container" className="max-w-3xl mx-auto space-y-8 py-4 animate-in fade-in duration-150">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button
          id="btn-back-to-trips"
          variant="outline"
          size="sm"
          onClick={() => {
            if (currentStep > 1) {
              goToPrevStep();
            } else {
              onBack();
            }
          }}
          icon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          {currentStep > 1 ? `Back to Step ${currentStep - 1}` : 'Back to Dashboard'}
        </Button>

        {/* Trip Switcher Dropdown (only when editing an existing trip and multiple trips exist) */}
        {initialTripId && availableTrips.length > 1 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#5C6460]">Planning for:</span>
            <select
              id="select-active-trip"
              value={activeTripId || ''}
              onChange={(e) => setActiveTripId(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-[#E8E2D9] rounded-xl text-xs font-medium text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
            >
              {availableTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.destination})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Fresh New Trip Planning Title */}
      {!initialTripId && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#2E5658] bg-[#EEF4F3] px-2.5 py-0.5 rounded-full border border-[#D3E2E0]">
              New Trip Planning
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1F2421]">
            Plan Your Next Adventure
          </h1>
          <p className="text-xs sm:text-sm text-[#5C6460]">
            Answer a few quick questions to build your personalized AI itinerary with activities, routes, and budget estimates.
          </p>
        </div>
      )}

      {/* Notice if an itinerary is already generated (only when editing an existing trip) */}
      {initialTripId && activeItinerary && (
        <div className="p-4 bg-[#EEF4F3] border border-[#D3E2E0] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#2E5658]">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#2E5658] shrink-0" />
            <span>
              <strong>Itinerary Active:</strong> This trip currently has a planned schedule. Updating parameters below will regenerate an optimized plan.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowEditForm(false)}
            className="shrink-0 bg-white"
          >
            View Current Itinerary
          </Button>
        </div>
      )}

      {/* Small Trip Summary Header (only when editing an existing trip) */}
      {initialTripId && trip && (
        <Card id="plan-trip-summary-header" variant="surface" className="p-5 border-l-4 border-l-[#2E5658] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[#2E5658]">
                Target Trip
              </span>
              <h1 id="trip-summary-name" className="text-xl font-bold text-[#1F2421]">
                {trip.name}
              </h1>
            </div>
            <Badge variant="teal" className="text-xs">
              {trip.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs border-t border-[#E8E2D9]">
            <div className="space-y-0.5">
              <span className="text-[#5C6460] flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#2E5658]" /> Destination
              </span>
              <p className="font-semibold text-[#1F2421] truncate">{destination || trip.destination}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[#5C6460] flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#2E5658]" /> Dates
              </span>
              <p className="font-semibold text-[#1F2421]">
                {startDate && endDate ? formatDateRange(startDate, endDate) : `${trip.startDate} – ${trip.endDate}`}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[#5C6460] flex items-center gap-1">
                <Users className="w-3 h-3 text-[#2E5658]" /> Travelers
              </span>
              <p className="font-semibold text-[#1F2421]">
                {travelers} ({tripType})
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[#5C6460] flex items-center gap-1">
                <IndianRupee className="w-3 h-3 text-[#2E5658]" /> Daily Budget
              </span>
              <p className="font-semibold text-[#1F2421]">
                ₹{dailyBudget ? Number(dailyBudget).toLocaleString('en-IN') : trip.dailyBudget.toLocaleString('en-IN')}/day
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Multi-Step Wizard Progress Indicator */}
      <div id="plan-wizard-progress" className="space-y-3">
        {/* Desktop Step Tabs */}
        <div className="hidden sm:grid grid-cols-6 gap-2">
          {WIZARD_STEPS.map((stepItem) => {
            const isCurrent = currentStep === stepItem.step;
            const isCompleted = currentStep > stepItem.step;
            return (
              <button
                key={stepItem.step}
                type="button"
                onClick={() => {
                  if (isCompleted || validateStep(currentStep)) {
                    setCurrentStep(stepItem.step);
                  }
                }}
                className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-[#EEF4F3] border-[#D3E2E0] shadow-2xs'
                    : isCompleted
                    ? 'bg-white border-[#E8E2D9] hover:bg-[#FAF7F2]'
                    : 'bg-white/40 border-[#E8E2D9]/60 opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isCurrent
                        ? 'bg-[#2E5658] text-white'
                        : isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-[#FAF7F2] text-[#5C6460]'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3 h-3" /> : stepItem.step}
                  </div>
                  <span
                    className={`text-xs font-bold truncate ${
                      isCurrent ? 'text-[#2E5658]' : 'text-[#1F2421]'
                    }`}
                  >
                    {stepItem.title}
                  </span>
                </div>
                <p className="text-[10px] text-[#5C6460] truncate">{stepItem.shortDesc}</p>
              </button>
            );
          })}
        </div>

        {/* Mobile Step Header */}
        <div className="sm:hidden p-3.5 bg-white border border-[#E8E2D9] rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#2E5658]">
              Step {currentStep} of 6
            </span>
            <h3 className="text-sm font-bold text-[#1F2421]">
              {WIZARD_STEPS[currentStep - 1].title}
            </h3>
          </div>
          <div className="w-20 bg-[#FAF7F2] rounded-full h-2 overflow-hidden border border-[#E8E2D9]">
            <div
              className="bg-[#2E5658] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 6) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Global Form Error Banner */}
      {formError && (
        <div
          id="plan-trip-form-error"
          className="p-4 bg-[#FAF0EC] border border-[#F5D8CE] rounded-xl flex items-start gap-3 text-xs text-[#C85A32]"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              {formErrorType === 'validation'
                ? 'Information Needed'
                : 'Unable to generate your itinerary'}
            </p>
            <p>{formError}</p>
          </div>
        </div>
      )}

      {/* STEP 1: DESTINATION */}
      {currentStep === 1 && (
        <Card variant="surface" className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-3 border-b border-[#E8E2D9]">
            <div className="w-10 h-10 rounded-2xl bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1F2421]">Destination & Starting City</h2>
              <p className="text-xs text-[#5C6460]">Where are you headed, and where does your journey begin?</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-3">
              <label htmlFor="input-plan-name" className="block text-xs font-semibold text-[#1F2421]">
                Trip Name <span className="text-[#78716C] font-normal">(Optional — e.g. "Goa Monsoon Getaway")</span>
              </label>
              <input
                id="input-plan-name"
                type="text"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder={destination ? `${destination} Adventure` : 'e.g. Manali Himalayan Escape'}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-1">
              <label htmlFor="input-plan-destination" className="block text-xs font-semibold text-[#1F2421]">
                Destination / City <span className="text-[#CF8A70]">*</span>
              </label>
              <input
                id="input-plan-destination"
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Manali, Goa, Tokyo, Paris"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-1">
              <label htmlFor="input-plan-origin" className="block text-xs font-semibold text-[#1F2421]">
                Starting From <span className="text-[#78716C] font-normal">(Optional Origin)</span>
              </label>
              <input
                id="input-plan-origin"
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Delhi, Mumbai, Bengaluru"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-1">
              <label htmlFor="input-plan-region" className="block text-xs font-semibold text-[#1F2421]">
                Focus Area / Region <span className="text-[#78716C] font-normal">(Optional)</span>
              </label>
              <input
                id="input-plan-region"
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Old Manali, North Goa, Shibuya"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
              />
            </div>
          </div>

          {/* Quick presets for common destinations */}
          <div className="pt-2">
            <span className="text-xs font-semibold text-[#5C6460] block mb-2">Quick Inspiration:</span>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_DESTINATIONS.map((sample) => (
                <button
                  key={sample.city}
                  type="button"
                  onClick={() => {
                    setDestination(sample.city);
                    setRegion(sample.region);
                    if (sample.origin) setOrigin(sample.origin);
                  }}
                  className="px-3 py-1.5 text-xs bg-[#FAF7F2] hover:bg-[#EEF4F3] text-[#5C6460] hover:text-[#2E5658] border border-[#E8E2D9] rounded-full transition cursor-pointer"
                >
                  {sample.city} {sample.origin ? `(from ${sample.origin})` : ''}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* STEP 2: DATES & BUDGET */}
      {currentStep === 2 && (
        <Card variant="surface" className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-3 border-b border-[#E8E2D9]">
            <div className="w-10 h-10 rounded-2xl bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1F2421]">Dates & Daily Budget</h2>
              <p className="text-xs text-[#5C6460]">Define the trip timeframe and per-day spending target</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="input-plan-startdate" className="block text-xs font-semibold text-[#1F2421]">
                Start Date <span className="text-[#CF8A70]">*</span>
              </label>
              <input
                id="input-plan-startdate"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="input-plan-enddate" className="block text-xs font-semibold text-[#1F2421]">
                End Date <span className="text-[#CF8A70]">*</span>
              </label>
              <input
                id="input-plan-enddate"
                type="date"
                required
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
              />
            </div>
          </div>

          {startDate && endDate && (
            <div className="p-3.5 bg-[#FAF7F2] border border-[#E8E2D9] rounded-xl flex items-center justify-between text-xs">
              <span className="text-[#5C6460]">Trip Duration:</span>
              <span className="font-bold text-[#2E5658]">
                {currentDays} {currentDays === 1 ? 'day' : 'days'} ({formatDateRange(startDate, endDate)})
              </span>
            </div>
          )}

          {/* Daily Budget Section */}
          <div className="space-y-3 pt-2 border-t border-[#E8E2D9]">
            <div className="space-y-1">
              <label htmlFor="input-plan-budget" className="block text-xs font-semibold text-[#1F2421]">
                Daily Budget Target (INR &bull; ₹) <span className="text-[#CF8A70]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#5C6460] font-semibold">
                  ₹
                </span>
                <input
                  id="input-plan-budget"
                  type="number"
                  min="500"
                  step="500"
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(Math.max(0, Number(e.target.value)))}
                  placeholder="e.g. 4000"
                  className="w-full pl-8 pr-3.5 py-2.5 text-sm bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
                />
              </div>
            </div>

            {/* Quick Budget Tiers */}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-xs text-[#5C6460] self-center mr-1">Suggested:</span>
              {[
                { label: 'Backpacker (₹1,500)', val: 1500 },
                { label: 'Standard (₹4,000)', val: 4000 },
                { label: 'Comfort (₹8,000)', val: 8000 },
                { label: 'Luxury (₹15,000)', val: 15000 },
              ].map((tier) => (
                <button
                  key={tier.val}
                  type="button"
                  onClick={() => setDailyBudget(tier.val)}
                  className={`px-3 py-1 text-xs rounded-full border transition cursor-pointer ${
                    dailyBudget === tier.val
                      ? 'bg-[#EEF4F3] border-[#D3E2E0] text-[#2E5658] font-semibold'
                      : 'bg-white border-[#E8E2D9] text-[#5C6460] hover:bg-[#FAF7F2]'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* STEP 3: TRAVELLERS & STYLE */}
      {currentStep === 3 && (
        <Card variant="surface" className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-3 border-b border-[#E8E2D9]">
            <div className="w-10 h-10 rounded-2xl bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1F2421]">Travellers & Travel Pace</h2>
              <p className="text-xs text-[#5C6460]">Who is travelling, and what rhythm best matches your group?</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Number of Travelers Counter */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#1F2421]">
                Number of Travelers <span className="text-[#CF8A70]">*</span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  id="btn-decrement-travelers"
                  onClick={() => handleTravelersChange(travelers - 1)}
                  disabled={travelers <= 1}
                  className="w-10 h-10 rounded-xl bg-white border border-[#E8E2D9] flex items-center justify-center text-sm font-semibold text-[#1F2421] hover:bg-[#FAF7F2] disabled:opacity-40 transition-colors cursor-pointer"
                >
                  -
                </button>
                <div className="px-4 py-2 bg-white border border-[#E8E2D9] rounded-xl text-center min-w-[70px]">
                  <span className="text-base font-bold text-[#1F2421]">{travelers}</span>
                </div>
                <button
                  type="button"
                  id="btn-increment-travelers"
                  onClick={() => handleTravelersChange(travelers + 1)}
                  disabled={travelers >= 20}
                  className="w-10 h-10 rounded-xl bg-white border border-[#E8E2D9] flex items-center justify-center text-sm font-semibold text-[#1F2421] hover:bg-[#FAF7F2] disabled:opacity-40 transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Trip Type Pills */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#1F2421]">
                Trip Type <span className="text-[#CF8A70]">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {(['Solo', 'Couple', 'Friends', 'Family', 'Business'] as TripType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTripType(t)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      tripType === t
                        ? 'bg-[#EEF4F3] border-[#D3E2E0] text-[#2E5658]'
                        : 'bg-white border-[#E8E2D9] text-[#5C6460] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Travel Pace / Style Cards */}
          <div className="space-y-3 pt-4 border-t border-[#E8E2D9]">
            <label className="block text-xs font-semibold text-[#1F2421]">
              Travel Pace / Style
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TRAVEL_STYLES.map((style) => {
                const isSelected = travelStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setTravelStyle(style.id)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#2E5658] bg-[#EEF4F3]/60 shadow-xs'
                        : 'border-[#E8E2D9] bg-white hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-[#1F2421]">{style.label}</span>
                      <span className="text-[10px] text-[#2E5658] bg-[#EEF4F3] px-2 py-0.5 rounded-full font-semibold">
                        {style.badge}
                      </span>
                    </div>
                    <p className="text-xs text-[#5C6460] leading-relaxed mt-1">
                      {style.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* STEP 4: PREFERENCES / INTERESTS */}
      {currentStep === 4 && (
        <Card variant="surface" className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-3 border-b border-[#E8E2D9]">
            <div className="w-10 h-10 rounded-2xl bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1F2421]">Interests & Planning Preferences</h2>
              <p className="text-xs text-[#5C6460]">Select what you love to do and fine-tune AI route heuristics</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#1F2421]">
                Travel Interests <span className="text-[#CF8A70]">*</span>
              </label>
              <span className="text-xs text-[#5C6460]">
                {interests.length} selected
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {INTEREST_OPTIONS.map((item) => {
                const isSelected = interests.includes(item.id);
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleInterestToggle(item.id)}
                    className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'border-[#2E5658] bg-[#EEF4F3] text-[#2E5658]'
                        : 'border-[#E8E2D9] bg-white text-[#5C6460] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <IconComp className="w-5 h-5" />
                    <span className="text-xs font-semibold">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Optimization Toggles */}
          <div className="pt-4 border-t border-[#E8E2D9] space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5C6460]">
              Route & Activity Prioritization
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="p-3 bg-white border border-[#E8E2D9] rounded-xl flex items-center justify-between cursor-pointer hover:bg-[#FAF7F2]">
                <span className="text-[#1F2421] font-medium">Prioritize Signature Highlights</span>
                <input
                  type="checkbox"
                  checked={preferPopular}
                  onChange={(e) => setPreferPopular(e.target.checked)}
                  className="rounded text-[#2E5658] focus:ring-[#2E5658] w-4 h-4"
                />
              </label>
              <label className="p-3 bg-white border border-[#E8E2D9] rounded-xl flex items-center justify-between cursor-pointer hover:bg-[#FAF7F2]">
                <span className="text-[#1F2421] font-medium">Include Offbeat / Hidden Gems</span>
                <input
                  type="checkbox"
                  checked={preferHiddenGems}
                  onChange={(e) => setPreferHiddenGems(e.target.checked)}
                  className="rounded text-[#2E5658] focus:ring-[#2E5658] w-4 h-4"
                />
              </label>
              <label className="p-3 bg-white border border-[#E8E2D9] rounded-xl flex items-center justify-between cursor-pointer hover:bg-[#FAF7F2]">
                <span className="text-[#1F2421] font-medium">Cluster Nearby Stops Together</span>
                <input
                  type="checkbox"
                  checked={preferPlacesCloseTogether}
                  onChange={(e) => setPreferPlacesCloseTogether(e.target.checked)}
                  className="rounded text-[#2E5658] focus:ring-[#2E5658] w-4 h-4"
                />
              </label>
              <label className="p-3 bg-white border border-[#E8E2D9] rounded-xl flex items-center justify-between cursor-pointer hover:bg-[#FAF7F2]">
                <span className="text-[#1F2421] font-medium">Minimize Transit Time</span>
                <input
                  type="checkbox"
                  checked={minimizeTravelTime}
                  onChange={(e) => setMinimizeTravelTime(e.target.checked)}
                  className="rounded text-[#2E5658] focus:ring-[#2E5658] w-4 h-4"
                />
              </label>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 5: ACCOMMODATION */}
      {currentStep === 5 && (
        <Card variant="surface" className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-3 border-b border-[#E8E2D9]">
            <div className="w-10 h-10 rounded-2xl bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1F2421]">Accommodation / Stay</h2>
              <p className="text-xs text-[#5C6460]">Tell us where you are staying to anchor daily routes, or ask for guidance</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              id="stay-choice-none"
              onClick={() => setStayMode('none')}
              className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 cursor-pointer ${
                stayMode === 'none'
                  ? 'border-[#2E5658] bg-[#EEF4F3]/60 text-[#2E5658]'
                  : 'border-[#E8E2D9] bg-white text-[#5C6460] hover:bg-[#FAF7F2]'
              }`}
            >
              <div className="font-bold text-xs text-[#1F2421]">No Stay Yet</div>
              <p className="text-[11px] text-[#5C6460]">Skip for now. Plan routes around central landmarks.</p>
            </button>

            <button
              type="button"
              id="stay-choice-existing"
              onClick={() => setStayMode('existing')}
              className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 cursor-pointer ${
                stayMode === 'existing'
                  ? 'border-[#2E5658] bg-[#EEF4F3]/60 text-[#2E5658]'
                  : 'border-[#E8E2D9] bg-white text-[#5C6460] hover:bg-[#FAF7F2]'
              }`}
            >
              <div className="font-bold text-xs text-[#1F2421]">I Have a Booked Stay</div>
              <p className="text-[11px] text-[#5C6460]">Enter hotel details to anchor daily departures & returns.</p>
            </button>

            <button
              type="button"
              id="stay-choice-help-me-find"
              onClick={() => setStayMode('help_me_find')}
              className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 cursor-pointer ${
                stayMode === 'help_me_find'
                  ? 'border-[#2E5658] bg-[#EEF4F3]/60 text-[#2E5658]'
                  : 'border-[#E8E2D9] bg-white text-[#5C6460] hover:bg-[#FAF7F2]'
              }`}
            >
              <div className="font-bold text-xs text-[#1F2421]">Help Me Find Where to Stay</div>
              <p className="text-[11px] text-[#5C6460]">Get neighborhood recommendations matched to budget & transit.</p>
            </button>
          </div>

          {stayMode === 'existing' && (
            <div className="p-5 bg-[#FAF7F2] border border-[#E8E2D9] rounded-2xl space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="plan-stay-name" className="block text-xs font-semibold text-[#1F2421]">
                    Hotel or Property Name <span className="text-[#CF8A70]">*</span>
                  </label>
                  <input
                    id="plan-stay-name"
                    type="text"
                    placeholder="e.g. Heritage Haveli, Radisson Blu, Zostel"
                    value={stayName}
                    onChange={(e) => setStayName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="plan-stay-address" className="block text-xs font-semibold text-[#1F2421]">
                    Neighborhood or Address
                  </label>
                  <input
                    id="plan-stay-address"
                    type="text"
                    placeholder="e.g. Old Manali, Baga Beach, Civil Lines"
                    value={stayAddress}
                    onChange={(e) => setStayAddress(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421] focus:outline-none focus:ring-2 focus:ring-[#2E5658]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label htmlFor="plan-stay-checkin-date" className="block text-[11px] font-semibold text-[#1F2421]">
                    Check-in Date
                  </label>
                  <input
                    id="plan-stay-checkin-date"
                    type="date"
                    value={stayCheckInDate || startDate}
                    onChange={(e) => setStayCheckInDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421]"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="plan-stay-checkin-time" className="block text-[11px] font-semibold text-[#1F2421]">
                    Check-in Time
                  </label>
                  <input
                    id="plan-stay-checkin-time"
                    type="time"
                    value={stayCheckInTime}
                    onChange={(e) => setStayCheckInTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421]"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="plan-stay-checkout-date" className="block text-[11px] font-semibold text-[#1F2421]">
                    Check-out Date
                  </label>
                  <input
                    id="plan-stay-checkout-date"
                    type="date"
                    min={stayCheckInDate || startDate}
                    value={stayCheckOutDate || endDate}
                    onChange={(e) => setStayCheckOutDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421]"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="plan-stay-checkout-time" className="block text-[11px] font-semibold text-[#1F2421]">
                    Check-out Time
                  </label>
                  <input
                    id="plan-stay-checkout-time"
                    type="time"
                    value={stayCheckOutTime}
                    onChange={(e) => setStayCheckOutTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="plan-stay-notes" className="block text-xs font-semibold text-[#1F2421]">
                  Booking Notes <span className="text-[11px] text-[#78716C] font-normal">(Optional)</span>
                </label>
                <input
                  id="plan-stay-notes"
                  type="text"
                  placeholder="e.g. Booking ref #4891, Deluxe Room, breakfast included"
                  value={stayBookingNote}
                  onChange={(e) => setStayBookingNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E8E2D9] rounded-xl text-[#1F2421]"
                />
              </div>
            </div>
          )}

          {stayMode === 'help_me_find' && (
            <div className="p-4 bg-[#EEF4F3] border border-[#D3E2E0] rounded-2xl space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-xs font-bold text-[#2E5658]">
                <Sparkles className="w-4 h-4" />
                <span>AI Stay Neighborhood Guidance</span>
              </div>
              <p className="text-xs text-[#5C6460] leading-relaxed">
                TravelPilot will analyze your daily activity clusters, budget (₹{dailyBudget}/day), and {tripType} pace to suggest the most convenient neighborhoods in {destination || 'your destination'}.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* STEP 6: REVIEW & GENERATE */}
      {currentStep === 6 && (
        <Card variant="surface" className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 pb-3 border-b border-[#E8E2D9]">
            <div className="w-10 h-10 rounded-2xl bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#2E5658]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1F2421]">Review Your Trip Plan</h2>
              <p className="text-xs text-[#5C6460]">Verify your parameters before TravelPilot designs your daily schedule</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Destination & Schedule */}
            <div className="p-4 bg-[#FAF7F2] border border-[#E8E2D9] rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#5C6460] uppercase tracking-wider text-[10px]">
                  Destination & Schedule
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs font-semibold text-[#2E5658] hover:underline"
                >
                  Edit
                </button>
              </div>
              <p className="text-base font-bold text-[#1F2421]">{destination}</p>
              {origin && <p className="text-[#5C6460]">Departing from: {origin}</p>}
              {region && <p className="text-[#5C6460]">Focus area: {region}</p>}
              <p className="font-medium text-[#2E5658] pt-1 border-t border-[#E8E2D9]">
                {formatDateRange(startDate, endDate)} ({currentDays} days)
              </p>
            </div>

            {/* Budget & Travellers */}
            <div className="p-4 bg-[#FAF7F2] border border-[#E8E2D9] rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#5C6460] uppercase tracking-wider text-[10px]">
                  Budget & Travellers
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs font-semibold text-[#2E5658] hover:underline"
                >
                  Edit
                </button>
              </div>
              <p className="text-base font-bold text-[#1F2421]">
                ₹{Number(dailyBudget).toLocaleString('en-IN')} / day
              </p>
              <p className="text-[#5C6460]">
                {travelers} {travelers === 1 ? 'traveler' : 'travelers'} &bull; {tripType}
              </p>
              <p className="text-[#5C6460]">
                Pace: <strong>{travelStyle}</strong> ({travelStyle === 'Relaxed' ? '1–2 stops/day' : travelStyle === 'Balanced' ? '2–3 stops/day' : '4+ stops/day'})
              </p>
            </div>

            {/* Selected Interests */}
            <div className="p-4 bg-[#FAF7F2] border border-[#E8E2D9] rounded-2xl space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#5C6460] uppercase tracking-wider text-[10px]">
                  Selected Interests & Pacing
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="text-xs font-semibold text-[#2E5658] hover:underline"
                >
                  Edit
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {interests.map((i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-white border border-[#E8E2D9] rounded-full text-xs font-medium text-[#1F2421]"
                  >
                    {i}
                  </span>
                ))}
              </div>
            </div>

            {/* Accommodation */}
            <div className="p-4 bg-[#FAF7F2] border border-[#E8E2D9] rounded-2xl space-y-1 sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#5C6460] uppercase tracking-wider text-[10px]">
                  Accommodation
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="text-xs font-semibold text-[#2E5658] hover:underline"
                >
                  Edit
                </button>
              </div>
              {stayMode === 'existing' ? (
                <div>
                  <p className="font-bold text-[#1F2421]">{stayName}</p>
                  <p className="text-[#5C6460]">{stayAddress}</p>
                </div>
              ) : stayMode === 'help_me_find' ? (
                <p className="text-[#5C6460]">TravelPilot will suggest neighborhood bases matched to your routes.</p>
              ) : (
                <p className="text-[#78716C]">No stay recorded yet (activities planned from central landmarks).</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Step Navigation Controls Bar */}
      <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#E8E2D9]">
        <div>
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={goToPrevStep}
              disabled={isSubmitting}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Previous Step
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onBack}
              disabled={isSubmitting}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Dashboard
            </Button>
          )}
        </div>

        <div>
          {currentStep < 6 ? (
            <Button
              type="button"
              id="btn-wizard-next"
              variant="primary"
              size="md"
              onClick={goToNextStep}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Next: {WIZARD_STEPS[currentStep].title}
            </Button>
          ) : (
            <Button
              type="button"
              id="btn-generate-plan"
              variant="primary"
              size="md"
              onClick={handleGeneratePlan}
              disabled={isSubmitting || !destination.trim() || interests.length === 0}
              icon={<Sparkles className="w-4 h-4" />}
              className="shadow-xs"
            >
              {isSubmitting ? 'Designing Itinerary...' : 'Generate Itinerary with AI'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

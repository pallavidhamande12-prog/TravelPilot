import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Compass,
  MapPin,
  Calendar,
  Users,
  IndianRupee,
  CheckCircle2,
  Sliders,
  ChevronRight,
  Check,
  Trees,
  Utensils,
  Landmark,
  Camera,
  Star,
  Gem,
  Navigation,
  Car,
  Plane,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ShoppingBag,
  Moon,
  Coffee,
  Mountain,
} from 'lucide-react';
import {
  Trip,
  TripType,
  TravelInterest,
  TravelStyle,
  TripPlanningParameters,
  TripItinerary,
  UserTrip,
  SurpriseDestinationSuggestion,
} from '../../types';
import {
  createTrip,
  saveTripPlanningParameters,
  saveTripItinerary,
  getUserTrips,
} from '../../lib/tripService';
import { generatePlan } from '../../services/planner';
import {
  fetchSurpriseDestinations,
  reverseGeocodeLocation,
} from '../../services/surpriseService';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ItineraryView } from '../itinerary/ItineraryView';
import { AILoadingScreen } from '../itinerary/AILoadingScreen';

interface SurpriseMeViewProps {
  onBack: () => void;
  onOpenTrip: (tripId: string) => void;
  onCustomPlan: () => void;
}

type SurpriseStep =
  | 'explore-choice'
  | 'within-city-form'
  | 'outside-city-form'
  | 'outside-suggestions'
  | 'planning-questionnaire'
  | 'generating'
  | 'itinerary-view';

const ALL_INTERESTS: { label: TravelInterest; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'Food', icon: Utensils },
  { label: 'Nature', icon: Trees },
  { label: 'Relaxation', icon: Coffee },
  { label: 'Photography', icon: Camera },
  { label: 'History & Culture', icon: Landmark },
  { label: 'Adventure', icon: Mountain },
  { label: 'Popular Attractions', icon: Star },
  { label: 'Hidden Gems', icon: Gem },
  { label: 'Shopping', icon: ShoppingBag },
  { label: 'Nightlife', icon: Moon },
];

function getDefaultStartDate(offsetDays = 5): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function computeEndDate(startDateStr: string, duration: number): string {
  try {
    const d = new Date(startDateStr);
    d.setDate(d.getDate() + (Math.max(1, duration) - 1));
    return d.toISOString().split('T')[0];
  } catch {
    return startDateStr;
  }
}

function formatDateDisplay(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export const SurpriseMeView: React.FC<SurpriseMeViewProps> = ({
  onBack,
  onOpenTrip,
  onCustomPlan,
}) => {
  const { user, profile } = useAuth();

  // Navigation / Step
  const [step, setStep] = useState<SurpriseStep>('explore-choice');
  const [explorationScope, setExplorationScope] = useState<'within' | 'outside' | null>(null);

  // Constraints State
  const [startingLocation, setStartingLocation] = useState<string>('');
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'success' | 'error'>('idle');
  const [locationErrorMsg, setLocationErrorMsg] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(getDefaultStartDate(5));
  const [durationDays, setDurationDays] = useState<number>(3);
  const [dailyBudget, setDailyBudget] = useState<number>(4500);
  const [travelers, setTravelers] = useState<number>(2);
  const [tripType, setTripType] = useState<TripType>('Couple');
  const [travelStyle, setTravelStyle] = useState<TravelStyle>('Balanced');
  const [interests, setInterests] = useState<TravelInterest[]>([
    'Food',
    'Nature',
    'Relaxation',
    'Photography',
  ]);
  const [placePreference, setPlacePreference] = useState<'popular' | 'hidden_gems' | 'mix'>('mix');

  // Outside City Suggestions State
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SurpriseDestinationSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SurpriseDestinationSuggestion | null>(null);

  // Planning Questionnaire State
  const [originCoordinates, setOriginCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [resolvedCity, setResolvedCity] = useState<string>('');
  const [resolvedState, setResolvedState] = useState<string>('');
  const [resolvedCountry, setResolvedCountry] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [origin, setOrigin] = useState<string>('');
  const [preferPopular, setPreferPopular] = useState<boolean>(true);
  const [preferHiddenGems, setPreferHiddenGems] = useState<boolean>(true);
  const [preferPlacesCloseTogether, setPreferPlacesCloseTogether] = useState<boolean>(true);
  const [minimizeTravelTime, setMinimizeTravelTime] = useState<boolean>(true);
  const [preferLowerCost, setPreferLowerCost] = useState<boolean>(false);
  const [destinationTripId, setDestinationTripId] = useState<string>('create-new');
  const [availableTrips, setAvailableTrips] = useState<UserTrip[]>([]);

  // Generation & Result State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [activeItinerary, setActiveItinerary] = useState<TripItinerary | null>(null);

  // Compute calculated end date
  const calculatedEndDate = computeEndDate(startDate, durationDays);

  // Load user trips for destination container choice
  useEffect(() => {
    let isMounted = true;
    async function loadTrips() {
      if (!user) return;
      try {
        const trips = await getUserTrips(user.uid);
        if (isMounted) setAvailableTrips(trips);
      } catch (err) {
        console.warn('Failed to load trips in surprise view:', err);
      }
    }
    loadTrips();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Handle Interest Toggle
  const toggleInterest = (interest: TravelInterest) => {
    if (interests.includes(interest)) {
      if (interests.length > 1) {
        setInterests(interests.filter((i) => i !== interest));
      }
    } else {
      setInterests([...interests, interest]);
    }
  };

  // Geolocation Handler for "Use My Current Location"
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationErrorMsg('Browser geolocation is not supported on this device. Please enter your city or state below.');
      setLocationStatus('error');
      return;
    }

    setLocationStatus('locating');
    setLocationErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const result = await reverseGeocodeLocation(latitude, longitude);
          if (!result || !result.city || !result.city.trim()) {
            throw new Error('Unable to determine a reliable city name from coordinates');
          }
          const formatted = result.formatted || `${result.city}${result.state ? `, ${result.state}` : ''}${result.country ? `, ${result.country}` : ''}`;
          setStartingLocation(formatted);
          setOriginCoordinates({ latitude, longitude });
          setResolvedCity(result.city.trim());
          setResolvedState(result.state?.trim() || '');
          setResolvedCountry(result.country?.trim() || '');
          setLocationStatus('success');
          setLocationErrorMsg(null);
        } catch (err) {
          console.warn('Geolocation reverse geocode error:', err);
          setLocationErrorMsg('Unable to determine your city name from coordinates. Please enter your city or state manually below.');
          setLocationStatus('error');
        }
      },
      (err) => {
        console.warn('Geolocation permission error:', err);
        let msg = 'Location permission was denied or unavailable. Please choose your city or state below.';
        if (err.code === 1) {
          msg = 'Location permission was denied. Please enter your city or state manually below.';
        } else if (err.code === 2) {
          msg = 'Location is unavailable. Please enter your city or state manually below.';
        } else if (err.code === 3) {
          msg = 'Location lookup timed out. Please enter your city or state manually below.';
        }
        setLocationErrorMsg(msg);
        setLocationStatus('error');
      },
      { timeout: 10000, maximumAge: 600000, enableHighAccuracy: false }
    );
  };

  // Step 2A: Proceed from Within My City to Planning Questionnaire
  const handleProceedWithinCity = () => {
    const loc = startingLocation.trim();
    if (!loc) {
      setLocationErrorMsg('Please choose your starting city or detect your location.');
      return;
    }
    const anchor = resolvedCity || loc.split(',')[0].trim() || loc;
    setDestination(`${anchor} & Nearby Scenic Circuit`);
    setRegion(`${anchor} & Surrounding Day-Trip Area (0–80 km)`);
    setOrigin(loc);
    setPreferPlacesCloseTogether(true);
    setMinimizeTravelTime(true);
    setPreferPopular(placePreference === 'popular' || placePreference === 'mix');
    setPreferHiddenGems(placePreference === 'hidden_gems' || placePreference === 'mix');
    setStep('planning-questionnaire');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 2B: Fetch Destination Suggestions for Outside My City
  const handleFindOutsideDestinations = async () => {
    if (!startingLocation.trim()) {
      setLocationErrorMsg('Please provide a starting location (city, airport, or region).');
      return;
    }

    setIsDiscovering(true);
    setDiscoveryError(null);

    try {
      const results = await fetchSurpriseDestinations({
        startingLocation: startingLocation.trim(),
        startDate,
        endDate: calculatedEndDate,
        durationDays,
        dailyBudget,
        travelers,
        tripType,
        travelStyle,
        interests,
        placePreference,
      });

      if (!results || results.length === 0) {
        throw new Error('No destination recommendations could be generated. Please try again.');
      }

      setSuggestions(results);
      setStep('outside-suggestions');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      console.error('Surprise destination discovery error:', err);
      setDiscoveryError(
        err instanceof Error
          ? err.message
          : "TravelPilot couldn't discover destinations right now. Please try again."
      );
    } finally {
      setIsDiscovering(false);
    }
  };

  // Step 3: Handle Destination Selection
  const handleSelectDestination = (suggestion: SurpriseDestinationSuggestion) => {
    setSelectedSuggestion(suggestion);
    setDestination(suggestion.destination);
    setRegion(suggestion.region || `${suggestion.destination} Area`);
    setOrigin(startingLocation.trim() || 'Starting Hub');
    if (suggestion.estimatedDailyCost) {
      setDailyBudget(suggestion.estimatedDailyCost);
    }
    setPreferPopular(placePreference === 'popular' || placePreference === 'mix');
    setPreferHiddenGems(placePreference === 'hidden_gems' || placePreference === 'mix');
    setStep('planning-questionnaire');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 4: Execute Plan Generation using existing central generatePlan(params) engine
  const handleGeneratePlan = async () => {
    if (!user) return;
    setGenerationError(null);

    const isWithin = explorationScope === 'within';
    const anchorCity = resolvedCity || (origin ? origin.split(',')[0].trim() : '') || destination.split('&')[0].trim();

    const planningPayload: TripPlanningParameters = {
      mode: isWithin ? 'within_city' : 'outside_city',
      travelMode: isWithin ? 'road_trip' : 'standard',
      destinationScope: isWithin ? 'nearby' : 'standard',
      origin: origin.trim() || undefined,
      destination: destination.trim(),
      region: region.trim() || undefined,
      resolvedCity: anchorCity || undefined,
      resolvedState: resolvedState || undefined,
      resolvedCountry: resolvedCountry || undefined,
      originCoordinates: originCoordinates || undefined,
      startDate,
      endDate: calculatedEndDate,
      travelers: Number(travelers),
      tripType,
      dailyBudget: Number(dailyBudget),
      interests,
      travelStyle,
      preferPopular,
      preferHiddenGems,
      preferPlacesCloseTogether: true,
      minimizeTravelTime: true,
      preferLowerCost,
    };

    try {
      setIsGenerating(true);
      setStep('generating');
      let targetTripId = destinationTripId;

      // If user chose "create-new", create a dedicated trip container in Firestore
      if (destinationTripId === 'create-new') {
        const tripTitle =
          isWithin
            ? `${anchorCity} Scenic Road Trip & Getaways`
            : `${destination} Getaway`;

        const newTrip = await createTrip(
          {
            name: tripTitle,
            destination: destination.trim(),
            startDate,
            endDate: calculatedEndDate,
            dailyBudget,
            tripType,
          },
          user.uid,
          profile?.displayName || user.displayName || 'Traveler',
          profile?.photoURL || user.photoURL || ''
        );
        targetTripId = newTrip.id;
      }

      // Save planning parameters
      await saveTripPlanningParameters(targetTripId, planningPayload);

      // Call single central planning engine
      const planResult = await generatePlan({
        mode: 'initial',
        tripId: targetTripId,
        destination: planningPayload.destination,
        startDate: planningPayload.startDate,
        endDate: planningPayload.endDate,
        planning: planningPayload,
      });

      if (planResult.status === 'ready' && planResult.itinerary) {
        const tripWithItinerary = await saveTripItinerary(targetTripId, planResult.itinerary);
        setActiveTrip(tripWithItinerary);
        setActiveItinerary(planResult.itinerary);
        setStep('itinerary-view');
        setIsGenerating(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setIsGenerating(false);
        setStep('planning-questionnaire');
        setGenerationError(
          planResult.message || "TravelPilot couldn't gather enough reliable information for this destination. Please try again."
        );
      }
    } catch (err: unknown) {
      console.error('Surprise trip generation failed:', err);
      setIsGenerating(false);
      setStep('planning-questionnaire');
      setGenerationError(
        err instanceof Error
          ? err.message
          : "TravelPilot couldn't gather enough reliable information for this destination. Please try again."
      );
    }
  };

  // -------------------------------------------------------------
  // VIEW RENDERERS
  // -------------------------------------------------------------

  // Loading Screen while central itinerary engine generates full plan
  if (step === 'generating') {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <AILoadingScreen
          destination={destination}
          travelStyle={travelStyle}
        />
      </div>
    );
  }

  // Final Itinerary View (reusing existing ItineraryView)
  if (step === 'itinerary-view' && activeItinerary && activeTrip) {
    return (
      <div id="surprise-itinerary-container" className="max-w-4xl mx-auto space-y-6 py-6 animate-in fade-in duration-150">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Back to My Trips
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep('planning-questionnaire')}
            icon={<Sliders className="w-3.5 h-3.5" />}
          >
            Adjust Plan Preferences
          </Button>
        </div>

        <ItineraryView
          trip={activeTrip}
          itinerary={activeItinerary}
          onEditPreferences={() => setStep('planning-questionnaire')}
          onBackToOverview={() => onOpenTrip(activeTrip.id)}
          onReplan={handleGeneratePlan}
          isReplanning={isGenerating}
          onUpdateItinerary={(updated) => setActiveItinerary(updated)}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // STEP 1: "Where do you want to explore?"
  // -------------------------------------------------------------
  if (step === 'explore-choice') {
    return (
      <div id="surprise-step-choice" className="max-w-3xl mx-auto space-y-8 py-6 animate-in fade-in duration-150">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Back to My Trips
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onCustomPlan}
            icon={<Sliders className="w-3.5 h-3.5" />}
          >
            Custom Plan a Trip
          </Button>
        </div>

        {/* Hero Section */}
        <div className="space-y-3 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#FAF2EF] text-[#CF8A70] border border-[#F0DDD6]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Destination Discovery</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1F2421]">
            Where do you want to explore?
          </h1>
          <p className="text-sm text-[#5C6460] max-w-2xl leading-relaxed">
            Choose whether you want to uncover local road trips and day getaways around your home base, or discover 4–5 curated destination options tailored to your travel style.
          </p>
        </div>

        {/* Two Scope Choices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Choice 1: Within My City / Nearby */}
          <button
            id="btn-choose-within-city"
            type="button"
            onClick={() => {
              setExplorationScope('within');
              setDurationDays(2);
              setStep('within-city-form');
            }}
            className="text-left group relative p-7 rounded-2xl bg-white border-2 border-[#E8E2D9] hover:border-[#2E5658] hover:shadow-md transition-all duration-200 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Car className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-[#1F2421] group-hover:text-[#2E5658] transition-colors">
                  Within My City / Nearby
                </h3>
                <p className="text-xs leading-relaxed text-[#5C6460]">
                  Scenic drives, weekend road trips, day escapes, and authentic local spots around your area.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2">
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-[#FAF8F5] text-[#5C6460] border border-[#E8E2D9]">
                  Road Trips
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-[#FAF8F5] text-[#5C6460] border border-[#E8E2D9]">
                  Driving Distance
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-[#FAF8F5] text-[#5C6460] border border-[#E8E2D9]">
                  Local Gems
                </span>
              </div>
            </div>

            <div className="pt-6 flex items-center gap-1.5 text-xs font-semibold text-[#2E5658] group-hover:translate-x-1 transition-transform">
              <span>Start Local Road Trip</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          {/* Choice 2: Outside My City */}
          <button
            id="btn-choose-outside-city"
            type="button"
            onClick={() => {
              setExplorationScope('outside');
              setDurationDays(3);
              setStep('outside-city-form');
            }}
            className="text-left group relative p-7 rounded-2xl bg-white border-2 border-[#E8E2D9] hover:border-[#2E5658] hover:shadow-md transition-all duration-200 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#FAF2EF] text-[#CF8A70] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Plane className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-[#1F2421] group-hover:text-[#2E5658] transition-colors">
                  Outside My City
                </h3>
                <p className="text-xs leading-relaxed text-[#5C6460]">
                  Discover 4–5 curated destination options tailored to your departure hub, dates, and budget.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2">
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-[#FAF8F5] text-[#5C6460] border border-[#E8E2D9]">
                  4–5 Curated Options
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-[#FAF8F5] text-[#5C6460] border border-[#E8E2D9]">
                  Flight & Rail Routes
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-[#FAF8F5] text-[#5C6460] border border-[#E8E2D9]">
                  Worldwide Discovery
                </span>
              </div>
            </div>

            <div className="pt-6 flex items-center gap-1.5 text-xs font-semibold text-[#CF8A70] group-hover:translate-x-1 transition-transform">
              <span>Discover Destinations</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STEP 2A: WITHIN MY CITY / NEARBY FORM
  // -------------------------------------------------------------
  if (step === 'within-city-form') {
    return (
      <div id="surprise-within-form" className="max-w-3xl mx-auto space-y-6 py-6 animate-in fade-in duration-150">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep('explore-choice')}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Change Exploration Scope
          </Button>

          <span className="text-xs font-medium text-[#5C6460]">Step 1 of 2: Trip Parameters</span>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E5658]">
            <Car className="w-3.5 h-3.5" />
            <span>Road Trip & Local Getaway Mode</span>
          </div>
          <h2 className="text-2xl font-bold text-[#1F2421]">Explore Within or Near Your City</h2>
          <p className="text-xs text-[#5C6460]">
            We will design a driving-friendly plan considering driving distance, logical geographic clustering, and estimated costs.
          </p>
        </div>

        {/* Starting Area Card */}
        <Card variant="surface" className="p-6 space-y-5 border border-[#E8E2D9]">
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#1F2421] uppercase tracking-wider block">
              1. Your Starting Area
            </label>
            <p className="text-xs text-[#5C6460]">
              Use browser geolocation or type your city/state as the anchor for road-trip exploration.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Button: Use My Current Location */}
            <button
              type="button"
              id="btn-use-current-location"
              onClick={handleUseCurrentLocation}
              disabled={locationStatus === 'locating'}
              className={`p-3.5 rounded-xl border flex items-center gap-3 text-left transition-all ${
                locationStatus === 'success'
                  ? 'border-[#2E5658] bg-[#EEF4F3]/50 text-[#2E5658]'
                  : 'border-[#E8E2D9] hover:border-[#2E5658] bg-white text-[#1F2421]'
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-[#EEF4F3] text-[#2E5658] flex items-center justify-center shrink-0">
                {locationStatus === 'locating' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold">Use My Current Location</p>
                <p className="text-[11px] text-[#5C6460] truncate">
                  {locationStatus === 'locating'
                    ? 'Detecting nearby city...'
                    : locationStatus === 'success'
                    ? 'Location detected'
                    : 'Request browser GPS'}
                </p>
              </div>
            </button>

            {/* Manual input indicator */}
            <div className="space-y-1">
              <label htmlFor="input-within-city" className="text-[11px] font-semibold text-[#5C6460] block">
                Choose My City / State
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5C6460]" />
                <input
                  id="input-within-city"
                  type="text"
                  placeholder="e.g. Pune, Maharashtra, India"
                  value={startingLocation}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartingLocation(val);
                    const parts = val.split(',').map((p) => p.trim());
                    setResolvedCity(parts[0] || '');
                    setResolvedState(parts[1] || '');
                    setResolvedCountry(parts[2] || '');
                    setOriginCoordinates(null);
                    setLocationStatus('idle');
                    setLocationErrorMsg(null);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E8E2D9] focus:outline-none focus:border-[#2E5658] bg-white text-[#1F2421]"
                />
              </div>
            </div>
          </div>

          {locationStatus === 'success' && startingLocation && (
            <div className="p-3 bg-[#EEF4F3] rounded-xl text-xs text-[#2E5658] flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Detected starting location: <strong>{startingLocation}</strong>
              </span>
              <span className="text-[11px] text-[#5C6460]">GPS Resolved</span>
            </div>
          )}

          {locationErrorMsg && (
            <div className="p-3 bg-[#FAF2EF] border border-[#F0DDD6] rounded-xl text-xs text-[#CF8A70] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{locationErrorMsg}</span>
            </div>
          )}
        </Card>

        {/* Trip Constraints Card */}
        <Card variant="surface" className="p-6 space-y-6 border border-[#E8E2D9]">
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#1F2421] uppercase tracking-wider block">
              2. Trip Constraints & Preferences
            </label>
            <p className="text-xs text-[#5C6460]">
              Customize your duration, daily budget, and pace for this local exploration.
            </p>
          </div>

          {/* Dates & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="within-start-date" className="text-xs font-semibold text-[#1F2421] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#2E5658]" />
                Start Date
              </label>
              <input
                id="within-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] text-xs focus:outline-none focus:border-[#2E5658]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="within-duration-select" className="text-xs font-semibold text-[#1F2421] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#2E5658]" />
                Duration ({durationDays} {durationDays === 1 ? 'day' : 'days'})
              </label>
              <select
                id="within-duration-select"
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] text-xs focus:outline-none focus:border-[#2E5658] bg-white"
              >
                <option value={1}>1 Day (Day Trip)</option>
                <option value={2}>2 Days (Weekend Getaway)</option>
                <option value={3}>3 Days (Long Weekend)</option>
                <option value={4}>4 Days</option>
                <option value={5}>5 Days</option>
              </select>
              <p className="text-[11px] text-[#5C6460]">
                {formatDateDisplay(startDate)} to {formatDateDisplay(calculatedEndDate)}
              </p>
            </div>
          </div>

          {/* Daily Budget Slider */}
          <div className="space-y-2 pt-2 border-t border-[#E8E2D9]">
            <div className="flex items-center justify-between">
              <label htmlFor="within-budget-slider" className="text-xs font-semibold text-[#1F2421] flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-[#2E5658]" />
                Daily Activity & Dining Budget (Estimated)
              </label>
              <span className="text-sm font-bold text-[#2E5658]">
                ₹{dailyBudget.toLocaleString('en-IN')} / day
              </span>
            </div>
            <input
              id="within-budget-slider"
              type="range"
              min={500}
              max={20000}
              step={100}
              value={dailyBudget}
              onChange={(e) => setDailyBudget(Number(e.target.value))}
              className="w-full accent-[#2E5658] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#5C6460]">
              <span>₹500/day</span>
              <span>Total for {durationDays} days: ~₹{(dailyBudget * durationDays).toLocaleString('en-IN')} (est.)</span>
              <span>₹20,000/day</span>
            </div>
          </div>

          {/* Travelers & Trip Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E8E2D9]">
            <div className="space-y-1.5">
              <label htmlFor="within-travelers-input" className="text-xs font-semibold text-[#1F2421] flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#2E5658]" />
                Travelers
              </label>
              <input
                id="within-travelers-input"
                type="number"
                min={1}
                max={12}
                value={travelers}
                onChange={(e) => setTravelers(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] text-xs focus:outline-none focus:border-[#2E5658]"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-[#1F2421] block">Trip Type</span>
              <div className="grid grid-cols-4 gap-1.5">
                {(['Solo', 'Couple', 'Family', 'Friends'] as TripType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTripType(t)}
                    className={`py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      tripType === t
                        ? 'border-[#2E5658] bg-[#2E5658] text-white'
                        : 'border-[#E8E2D9] bg-white text-[#1F2421] hover:border-[#2E5658]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Travel Pace */}
          <div className="space-y-1.5 pt-2 border-t border-[#E8E2D9]">
            <span className="text-xs font-semibold text-[#1F2421] block">Travel Pace</span>
            <div className="grid grid-cols-3 gap-2">
              {(['Relaxed', 'Balanced', 'Packed'] as TravelStyle[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTravelStyle(p)}
                  className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition-all ${
                    travelStyle === p
                      ? 'border-[#2E5658] bg-[#EEF4F3] text-[#2E5658] font-bold'
                      : 'border-[#E8E2D9] bg-white text-[#5C6460] hover:border-[#2E5658]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Atmosphere Preference */}
          <div className="space-y-1.5 pt-2 border-t border-[#E8E2D9]">
            <span className="text-xs font-semibold text-[#1F2421] block">Atmosphere Preference</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'popular', label: 'Popular Places' },
                { id: 'hidden_gems', label: 'Hidden Gems' },
                { id: 'mix', label: 'Balanced Mix' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPlacePreference(opt.id as 'popular' | 'hidden_gems' | 'mix')}
                  className={`py-2 px-2 text-xs font-medium rounded-xl border text-center transition-all ${
                    placePreference === opt.id
                      ? 'border-[#2E5658] bg-[#EEF4F3] text-[#2E5658] font-bold'
                      : 'border-[#E8E2D9] bg-white text-[#5C6460] hover:border-[#2E5658]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div className="space-y-2 pt-2 border-t border-[#E8E2D9]">
            <span className="text-xs font-semibold text-[#1F2421] block">Interests (Select 2 or more)</span>
            <div className="flex flex-wrap gap-2">
              {ALL_INTERESTS.map(({ label, icon: Icon }) => {
                const active = interests.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleInterest(label)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      active
                        ? 'border-[#2E5658] bg-[#2E5658] text-white'
                        : 'border-[#E8E2D9] bg-white text-[#5C6460] hover:border-[#2E5658]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => setStep('explore-choice')}
          >
            Cancel
          </Button>
          <Button
            id="btn-proceed-within-planning"
            variant="primary"
            onClick={handleProceedWithinCity}
            disabled={!startingLocation.trim()}
            icon={<ChevronRight className="w-4 h-4" />}
          >
            Continue to Planning Questionnaire
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STEP 2B: OUTSIDE MY CITY CONSTRAINTS FORM
  // -------------------------------------------------------------
  if (step === 'outside-city-form') {
    return (
      <div id="surprise-outside-form" className="max-w-3xl mx-auto space-y-6 py-6 animate-in fade-in duration-150">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep('explore-choice')}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Change Exploration Scope
          </Button>

          <span className="text-xs font-medium text-[#5C6460]">Step 1 of 3: Set Constraints</span>
        </div>

        {/* Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#CF8A70]">
            <Plane className="w-3.5 h-3.5" />
            <span>Outside City Discovery</span>
          </div>
          <h2 className="text-2xl font-bold text-[#1F2421]">Discover Destinations Beyond Your City</h2>
          <p className="text-xs text-[#5C6460]">
            Tell us where you are starting and your travel constraints. Gemini will suggest 4–5 destination options tailored to your inputs.
          </p>
        </div>

        {discoveryError && (
          <div className="p-4 bg-[#FAF2EF] border border-[#F0DDD6] rounded-xl text-xs text-[#CF8A70] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{discoveryError}</span>
          </div>
        )}

        <Card variant="surface" className="p-6 space-y-6 border border-[#E8E2D9]">
          {/* Starting Location */}
          <div className="space-y-2">
            <label htmlFor="input-outside-origin" className="text-xs font-bold text-[#1F2421] uppercase tracking-wider block">
              1. Starting Location (Departure City / Hub)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5C6460]" />
                <input
                  id="input-outside-origin"
                  type="text"
                  placeholder="e.g. Pune, Mumbai, Delhi, Bengaluru, London, San Francisco"
                  value={startingLocation}
                  onChange={(e) => {
                    setStartingLocation(e.target.value);
                    setLocationErrorMsg(null);
                  }}
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#E8E2D9] focus:outline-none focus:border-[#2E5658] bg-white text-[#1F2421]"
                />
              </div>

              <button
                type="button"
                id="btn-outside-current-location"
                onClick={handleUseCurrentLocation}
                disabled={locationStatus === 'locating'}
                className="px-3.5 py-2 rounded-xl border border-[#E8E2D9] hover:border-[#2E5658] text-xs font-medium text-[#2E5658] bg-white flex items-center justify-center gap-1.5 shrink-0"
              >
                {locationStatus === 'locating' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Navigation className="w-3.5 h-3.5" />
                )}
                <span>Use Current Location</span>
              </button>
            </div>
            {locationStatus === 'success' && (
              <p className="text-[11px] text-[#2E5658] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Set to {startingLocation}
              </p>
            )}
          </div>

          {/* Dates & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E8E2D9]">
            <div className="space-y-1.5">
              <label htmlFor="outside-start-date" className="text-xs font-semibold text-[#1F2421] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#2E5658]" />
                Start Date
              </label>
              <input
                id="outside-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] text-xs focus:outline-none focus:border-[#2E5658]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="outside-duration-select" className="text-xs font-semibold text-[#1F2421] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#2E5658]" />
                Trip Duration
              </label>
              <select
                id="outside-duration-select"
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] text-xs focus:outline-none focus:border-[#2E5658] bg-white"
              >
                <option value={2}>2 Days (Quick Getaway)</option>
                <option value={3}>3 Days (Long Weekend)</option>
                <option value={4}>4 Days</option>
                <option value={5}>5 Days</option>
                <option value={7}>7 Days (1 Week)</option>
                <option value={10}>10 Days</option>
              </select>
              <p className="text-[11px] text-[#5C6460]">
                {formatDateDisplay(startDate)} to {formatDateDisplay(calculatedEndDate)} ({durationDays} days)
              </p>
            </div>
          </div>

          {/* Budget Slider */}
          <div className="space-y-2 pt-2 border-t border-[#E8E2D9]">
            <div className="flex items-center justify-between">
              <label htmlFor="outside-budget-slider" className="text-xs font-semibold text-[#1F2421] flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-[#2E5658]" />
                Daily Activity & Dining Budget (Estimated)
              </label>
              <span className="text-sm font-bold text-[#2E5658]">
                ₹{dailyBudget.toLocaleString('en-IN')} / day
              </span>
            </div>
            <input
              id="outside-budget-slider"
              type="range"
              min={500}
              max={20000}
              step={100}
              value={dailyBudget}
              onChange={(e) => setDailyBudget(Number(e.target.value))}
              className="w-full accent-[#2E5658] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#5C6460]">
              <span>₹500/day</span>
              <span>Estimated {durationDays}-day total: ~₹{(dailyBudget * durationDays).toLocaleString('en-IN')}</span>
              <span>₹20,000/day</span>
            </div>
          </div>

          {/* Travelers & Trip Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E8E2D9]">
            <div className="space-y-1.5">
              <label htmlFor="outside-travelers-input" className="text-xs font-semibold text-[#1F2421] flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#2E5658]" />
                Travelers
              </label>
              <input
                id="outside-travelers-input"
                type="number"
                min={1}
                max={12}
                value={travelers}
                onChange={(e) => setTravelers(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] text-xs focus:outline-none focus:border-[#2E5658]"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-[#1F2421] block">Trip Type</span>
              <div className="grid grid-cols-4 gap-1.5">
                {(['Solo', 'Couple', 'Family', 'Friends'] as TripType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTripType(t)}
                    className={`py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      tripType === t
                        ? 'border-[#2E5658] bg-[#2E5658] text-white'
                        : 'border-[#E8E2D9] bg-white text-[#1F2421] hover:border-[#2E5658]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Travel Pace */}
          <div className="space-y-1.5 pt-2 border-t border-[#E8E2D9]">
            <span className="text-xs font-semibold text-[#1F2421] block">Travel Pace</span>
            <div className="grid grid-cols-3 gap-2">
              {(['Relaxed', 'Balanced', 'Packed'] as TravelStyle[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTravelStyle(p)}
                  className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition-all ${
                    travelStyle === p
                      ? 'border-[#2E5658] bg-[#EEF4F3] text-[#2E5658] font-bold'
                      : 'border-[#E8E2D9] bg-white text-[#5C6460] hover:border-[#2E5658]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Atmosphere Preference */}
          <div className="space-y-1.5 pt-2 border-t border-[#E8E2D9]">
            <span className="text-xs font-semibold text-[#1F2421] block">Atmosphere Preference</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'popular', label: 'Popular Places' },
                { id: 'hidden_gems', label: 'Hidden Gems' },
                { id: 'mix', label: 'Balanced Mix' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPlacePreference(opt.id as 'popular' | 'hidden_gems' | 'mix')}
                  className={`py-2 px-2 text-xs font-medium rounded-xl border text-center transition-all ${
                    placePreference === opt.id
                      ? 'border-[#2E5658] bg-[#EEF4F3] text-[#2E5658] font-bold'
                      : 'border-[#E8E2D9] bg-white text-[#5C6460] hover:border-[#2E5658]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div className="space-y-2 pt-2 border-t border-[#E8E2D9]">
            <span className="text-xs font-semibold text-[#1F2421] block">Interests (Select 2 or more)</span>
            <div className="flex flex-wrap gap-2">
              {ALL_INTERESTS.map(({ label, icon: Icon }) => {
                const active = interests.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleInterest(label)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      active
                        ? 'border-[#2E5658] bg-[#2E5658] text-white'
                        : 'border-[#E8E2D9] bg-white text-[#5C6460] hover:border-[#2E5658]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => setStep('explore-choice')}
          >
            Cancel
          </Button>
          <Button
            id="btn-find-surprise-destinations"
            variant="primary"
            onClick={handleFindOutsideDestinations}
            disabled={!startingLocation.trim() || isDiscovering}
            icon={isDiscovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          >
            {isDiscovering ? 'Discovering Destinations...' : 'Find Surprise Destinations'}
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STEP 3: 4–5 DESTINATION OPTIONS DISCOVERY SCREEN
  // -------------------------------------------------------------
  if (step === 'outside-suggestions') {
    return (
      <div id="surprise-suggestions-screen" className="max-w-4xl mx-auto space-y-6 py-6 animate-in fade-in duration-150">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep('outside-city-form')}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Adjust Constraints
          </Button>

          <span className="text-xs font-medium text-[#5C6460]">Step 2 of 3: Select Destination</span>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E5658]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Curated Options</span>
          </div>
          <h2 className="text-2xl font-bold text-[#1F2421]">
            Surprise Destination Options from {startingLocation}
          </h2>
          <p className="text-xs text-[#5C6460]">
            We found {suggestions.length} destinations matching your {durationDays}-day trip, {tripType.toLowerCase()} style, and ~₹{dailyBudget.toLocaleString('en-IN')}/day budget. Select one to proceed to detailed planning.
          </p>
        </div>

        {/* 4–5 Destination Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {suggestions.map((sug, idx) => (
            <Card
              key={sug.id || idx}
              variant="surface"
              className="p-6 space-y-4 border-2 border-[#E8E2D9] hover:border-[#2E5658] hover:shadow-md transition-all flex flex-col justify-between relative group"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-[#2E5658] uppercase tracking-wider">
                      Option #{idx + 1}
                    </span>
                    <h3 className="text-xl font-bold text-[#1F2421] group-hover:text-[#2E5658] transition-colors">
                      {sug.destination}
                    </h3>
                    {sug.region && (
                      <p className="text-xs text-[#5C6460] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-[#2E5658]" />
                        {sug.region}
                      </p>
                    )}
                  </div>

                  <a
                    href={sug.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg text-[#5C6460] hover:text-[#2E5658] hover:bg-[#FAF8F5] transition-colors"
                    title="Explore on Google Maps"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {/* Reason */}
                <p className="text-xs leading-relaxed text-[#1F2421] bg-[#FAF8F5] p-3 rounded-xl border border-[#E8E2D9]">
                  {sug.reason}
                </p>

                {/* Themes */}
                <div className="flex flex-wrap gap-1.5">
                  {sug.themes.map((theme) => (
                    <span
                      key={theme}
                      className="px-2.5 py-0.5 rounded-md text-[10px] font-medium bg-[#EEF4F3] text-[#2E5658]"
                    >
                      {theme}
                    </span>
                  ))}
                </div>

                {/* Travel Considerations */}
                <div className="text-xs text-[#5C6460] flex items-start gap-2 pt-1">
                  <Plane className="w-3.5 h-3.5 text-[#2E5658] shrink-0 mt-0.5" />
                  <span>{sug.travelConsiderations}</span>
                </div>

                {/* Cost Estimates */}
                <div className="pt-2 border-t border-[#E8E2D9] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-[#5C6460] block">Daily Activity Est.</span>
                    <span className="font-bold text-[#1F2421]">
                      ₹{sug.estimatedDailyCost.toLocaleString('en-IN')}/day
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#5C6460] block">Overall Trip Est.</span>
                    <span className="font-bold text-[#2E5658]">
                      ~₹{sug.estimatedTotalCost.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Selection Button */}
              <div className="pt-4 border-t border-[#E8E2D9]">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => handleSelectDestination(sug)}
                  icon={<ChevronRight className="w-4 h-4" />}
                >
                  Plan Trip to {sug.destination}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STEP 4: PLANNING QUESTIONNAIRE (REUSING EXISTING PARAMETERS)
  // -------------------------------------------------------------
  return (
    <div id="surprise-planning-form" className="max-w-3xl mx-auto space-y-6 py-6 animate-in fade-in duration-150">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (explorationScope === 'outside') {
              setStep('outside-suggestions');
            } else {
              setStep('within-city-form');
            }
          }}
          icon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          {explorationScope === 'outside' ? 'Back to Destination Options' : 'Back to Starting Area'}
        </Button>

        <span className="text-xs font-medium text-[#5C6460]">Final Step: Confirm Parameters</span>
      </div>

      {/* Hero Badge */}
      <div className="p-4 bg-[#EEF4F3] border border-[#2E5658]/20 rounded-2xl space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#2E5658]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Surprise Trip Selected: {destination}</span>
        </div>
        <p className="text-xs text-[#5C6460]">
          Review and confirm your itinerary parameters. TravelPilot will run the central itinerary engine to generate your Getting There, Why This Plan, and day-by-day schedule.
        </p>
      </div>

      {generationError && (
        <div className="p-4 bg-[#FAF2EF] border border-[#F0DDD6] rounded-xl text-xs text-[#CF8A70] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{generationError}</span>
        </div>
      )}

      {/* Planning Questionnaire Card */}
      <Card variant="surface" className="p-6 space-y-6 border border-[#E8E2D9]">
        {/* Destination & Origin */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="surprise-dest-input" className="text-xs font-semibold text-[#1F2421] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#2E5658]" />
              Destination
            </label>
            <input
              id="surprise-dest-input"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] text-xs font-bold focus:outline-none focus:border-[#2E5658] bg-[#FAF8F5]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="surprise-origin-input" className="text-xs font-semibold text-[#1F2421] flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-[#2E5658]" />
              Starting From (Origin)
            </label>
            <input
              id="surprise-origin-input"
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g. Pune, Mumbai, Delhi"
              className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] text-xs focus:outline-none focus:border-[#2E5658]"
            />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E8E2D9]">
          <div className="space-y-1.5">
            <label htmlFor="surprise-start-date" className="text-xs font-semibold text-[#1F2421] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#2E5658]" />
              Start Date
            </label>
            <input
              id="surprise-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] text-xs focus:outline-none focus:border-[#2E5658]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1F2421] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#2E5658]" />
              End Date ({durationDays} days)
            </label>
            <div className="px-3 py-2 rounded-xl border border-[#E8E2D9] bg-[#FAF8F5] text-xs text-[#5C6460]">
              {formatDateDisplay(calculatedEndDate)}
            </div>
          </div>
        </div>

        {/* Budget Slider */}
        <div className="space-y-2 pt-2 border-t border-[#E8E2D9]">
          <div className="flex items-center justify-between">
            <label htmlFor="surprise-plan-budget-slider" className="text-xs font-semibold text-[#1F2421] flex items-center gap-1">
              <IndianRupee className="w-3.5 h-3.5 text-[#2E5658]" />
              Daily Activity & Dining Budget (Estimated)
            </label>
            <span className="text-sm font-bold text-[#2E5658]">
              ₹{dailyBudget.toLocaleString('en-IN')} / day
            </span>
          </div>
          <input
            id="surprise-plan-budget-slider"
            type="range"
            min={500}
            max={20000}
            step={100}
            value={dailyBudget}
            onChange={(e) => setDailyBudget(Number(e.target.value))}
            className="w-full accent-[#2E5658] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#5C6460]">
            <span>₹500/day</span>
            <span>Est. total for {durationDays} days: ~₹{(dailyBudget * durationDays).toLocaleString('en-IN')}</span>
            <span>₹20,000/day</span>
          </div>
        </div>

        {/* Travelers & Trip Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E8E2D9]">
          <div className="space-y-1.5">
            <label htmlFor="surprise-plan-travelers" className="text-xs font-semibold text-[#1F2421] flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#2E5658]" />
              Travelers
            </label>
            <input
              id="surprise-plan-travelers"
              type="number"
              min={1}
              max={12}
              value={travelers}
              onChange={(e) => setTravelers(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] text-xs focus:outline-none focus:border-[#2E5658]"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-[#1F2421] block">Trip Type</span>
            <div className="grid grid-cols-4 gap-1.5">
              {(['Solo', 'Couple', 'Family', 'Friends'] as TripType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTripType(t)}
                  className={`py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    tripType === t
                      ? 'border-[#2E5658] bg-[#2E5658] text-white'
                      : 'border-[#E8E2D9] bg-white text-[#1F2421] hover:border-[#2E5658]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Travel Style / Pace */}
        <div className="space-y-1.5 pt-2 border-t border-[#E8E2D9]">
          <span className="text-xs font-semibold text-[#1F2421] block">Travel Pace</span>
          <div className="grid grid-cols-3 gap-2">
            {(['Relaxed', 'Balanced', 'Packed'] as TravelStyle[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTravelStyle(p)}
                className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition-all ${
                  travelStyle === p
                    ? 'border-[#2E5658] bg-[#EEF4F3] text-[#2E5658] font-bold'
                    : 'border-[#E8E2D9] bg-white text-[#5C6460] hover:border-[#2E5658]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Interests */}
        <div className="space-y-2 pt-2 border-t border-[#E8E2D9]">
          <span className="text-xs font-semibold text-[#1F2421] block">Selected Interests</span>
          <div className="flex flex-wrap gap-2">
            {ALL_INTERESTS.map(({ label, icon: Icon }) => {
              const active = interests.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleInterest(label)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? 'border-[#2E5658] bg-[#2E5658] text-white'
                      : 'border-[#E8E2D9] bg-white text-[#5C6460] hover:border-[#2E5658]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optimization Checkboxes */}
        <div className="space-y-2 pt-2 border-t border-[#E8E2D9]">
          <span className="text-xs font-semibold text-[#1F2421] block">Route & Place Preferences</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-[#E8E2D9] bg-white cursor-pointer hover:bg-[#FAF8F5]">
              <input
                type="checkbox"
                checked={preferPlacesCloseTogether}
                onChange={(e) => setPreferPlacesCloseTogether(e.target.checked)}
                className="accent-[#2E5658]"
              />
              <span className="text-xs text-[#1F2421]">Cluster places to minimize cross-city transit</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-[#E8E2D9] bg-white cursor-pointer hover:bg-[#FAF8F5]">
              <input
                type="checkbox"
                checked={minimizeTravelTime}
                onChange={(e) => setMinimizeTravelTime(e.target.checked)}
                className="accent-[#2E5658]"
              />
              <span className="text-xs text-[#1F2421]">Minimize transit time between stops</span>
            </label>
          </div>
        </div>

        {/* Trip Destination Container */}
        <div className="space-y-1.5 pt-2 border-t border-[#E8E2D9]">
          <label htmlFor="surprise-trip-target" className="text-xs font-semibold text-[#1F2421] block">
            Save Trip Under
          </label>
          <select
            id="surprise-trip-target"
            value={destinationTripId}
            onChange={(e) => setDestinationTripId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#E8E2D9] text-xs focus:outline-none focus:border-[#2E5658] bg-white"
          >
            <option value="create-new">+ Create as a new trip in My Trips</option>
            {availableTrips.map((t) => (
              <option key={t.id} value={t.id}>
                Save into existing trip: {t.name} ({t.destination})
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Generate Plan Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          variant="outline"
          onClick={() => {
            if (explorationScope === 'outside') {
              setStep('outside-suggestions');
            } else {
              setStep('within-city-form');
            }
          }}
        >
          Back
        </Button>

        <Button
          id="btn-generate-surprise-plan"
          variant="primary"
          onClick={handleGeneratePlan}
          disabled={!destination.trim() || isGenerating}
          icon={<Sparkles className="w-4 h-4" />}
        >
          {isGenerating ? 'Generating Itinerary...' : 'Generate My Plan'}
        </Button>
      </div>
    </div>
  );
};

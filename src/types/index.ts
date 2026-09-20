/**
 * Core type definitions for TravelPilot
 */

export type ExternalProviderType =
  | 'google_maps'
  | 'uber'
  | 'ola'
  | 'rapido'
  | 'irctc'
  | 'redbus'
  | 'flight'
  | 'hotel';

export interface ExternalLinkAction {
  label: string;
  provider: ExternalProviderType;
  url: string;
  description?: string;
}

/**
 * Parameter structure reserved for the single central planning engine:
 * generatePlan(params)
 *
 * This single contract will handle:
 * 1. Initial plan creation
 * 2. Replacement of removed itinerary items
 * 3. Re-planning after disruptions
 */
export interface GeneratePlanParams {
  mode: 'initial' | 'replace_item' | 'replan_disruption';
  tripId?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  planning?: TripPlanningParameters;
  preferences?: Record<string, unknown>;
  existingItineraryId?: string;
  targetItemId?: string;
  disruptionContext?: {
    type: string;
    affectedItemId?: string;
    severity?: 'low' | 'medium' | 'high';
    details?: string;
  };
}

export interface PlanResult {
  planId?: string;
  status: 'draft' | 'ready' | 'error';
  itinerary?: TripItinerary;
  message?: string;
}

/**
 * User profile document schema for users/{uid}
 */
export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  createdAt?: unknown;
  lastLoginAt?: unknown;
}

/**
 * Clean tri-state authentication model:
 * 1. loading: Initializing/checking auth state with Firebase
 * 2. authenticated: Firebase user signed in with profile document synced
 * 3. unauthenticated: No active session
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type TripType = 'Solo' | 'Friends' | 'Family' | 'Couple';
export type TripStatus = 'Planning' | 'Active' | 'Completed';
export type TripMemberRole = 'admin' | 'co-admin' | 'member';

export type TravelInterest =
  | 'Nature'
  | 'Adventure'
  | 'Food'
  | 'Shopping'
  | 'History & Culture'
  | 'Nightlife'
  | 'Relaxation'
  | 'Photography'
  | 'Hidden Gems'
  | 'Popular Attractions';

export type TravelStyle = 'Relaxed' | 'Balanced' | 'Packed';

export type StayMode = 'existing' | 'help_me_find';

export interface ExistingStayDetails {
  mode: 'existing';
  name: string;
  address: string;
  checkInDate: string;
  checkInTime?: string;
  checkOutDate: string;
  checkOutTime?: string;
  bookingNote?: string;
}

export interface StayRecommendation {
  area: string;
  whyItFits: string;
  budgetFit: string;
  suggestedType?: string;
  suggestedStayType?: string;
  searchUrl: string;
  searchDeepLinkUrl?: string;
  propertyName?: string;
}

export interface RecommendedStayDetails {
  mode: 'help_me_find';
  recommendations?: StayRecommendation[];
  preferredArea?: string;
  searchUrl?: string;
}

export type TripStay = ExistingStayDetails | RecommendedStayDetails;

export interface TripPlanningParameters {
  origin?: string; // Optional "Starting From" city (e.g. Pune, Mumbai, Delhi, Bengaluru)
  destination: string;
  region?: string;
  startDate: string;
  endDate: string;
  travelers: number;
  tripType: TripType;
  dailyBudget: number;
  interests: TravelInterest[];
  travelStyle: TravelStyle;
  preferPopular: boolean;
  preferHiddenGems: boolean;
  preferPlacesCloseTogether?: boolean;
  minimizeTravelTime: boolean;
  preferLowerCost: boolean;
  stay?: TripStay | null;
  updatedAt?: unknown;
  // Within-City and Surprise discovery metadata
  mode?: 'standard' | 'within_city' | 'outside_city';
  travelMode?: 'standard' | 'road_trip';
  destinationScope?: 'standard' | 'nearby';
  originCoordinates?: { latitude: number; longitude: number };
  resolvedCity?: string;
  resolvedState?: string;
  resolvedCountry?: string;
}

export interface ResolvedLocation {
  city: string;
  state?: string;
  country?: string;
  formatted: string;
  coordinates?: { latitude: number; longitude: number };
}

export type TransportMode = 'flight' | 'train' | 'bus' | 'road' | 'local';

export interface TransportOption {
  mode: TransportMode;
  title: string;
  description: string;
  estimatedDuration: string;
  costEstimate: string; // e.g. "Fare varies — check provider" or "Estimated from current information"
  isRecommended?: boolean;
  actionLabel: string; // e.g. "Search Flights", "Search Trains", "Search Buses", "Open Route in Google Maps"
  actionUrl: string;
  notes?: string;
}

export interface GettingThereInfo {
  origin?: string;
  destination: string;
  summary: string;
  options: TransportOption[];
}

export interface CandidateActivity {
  id: string;
  name: string;
  destination: string;
  area: string;
  category: string;
  estimatedCost: number;
  durationMinutes: number;
  suitableFor: TripType[];
  tags: TravelInterest[];
  lat: number;
  lng: number;
  openingTime: string;
  closingTime: string;
  mapsUrl: string;
  description?: string;
  isPopular?: boolean;
  isHiddenGem?: boolean;
}

export type ActivityStatus = 'planned' | 'completed' | 'skipped' | 'disrupted' | 'replaced';

export interface ItineraryActivity {
  candidateId: string;
  name: string;
  area: string;
  category: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  estimatedCost: number;
  travelTimeFromPrevious: string;
  mapsUrl: string;
  reason: string;
  distanceToNext?: string;
  // Dynamic Activity State
  status?: ActivityStatus;
  statusNote?: string;
  completedAt?: string;
  disruptionReason?: string;
  isReplacement?: boolean;
  replacementForCandidateId?: string;
  replacedByCandidateId?: string;
  replacedByActivityName?: string;
}

export type DisruptionType =
  | 'place_closed'
  | 'activity_unavailable'
  | 'booking_cancelled'
  | 'budget_exceeded'
  | 'route_unavailable'
  | 'weather_issue'
  | 'delay'
  | 'user_cannot_continue'
  | 'other';

export interface DisruptionReport {
  id: string;
  activityCandidateId: string;
  activityName: string;
  dayNumber: number;
  type: DisruptionType;
  description: string;
  reportedActualCost?: number;
  reportedAt: string;
}

export interface DisruptionImpactAnalysis {
  disruptedActivity: ItineraryActivity;
  dayNumber: number;
  impactSummary: string;
  directlyAffectedTimeSlot: string;
  completedActivitiesCount: number;
  remainingActivitiesCount: number;
  downstreamActivities: string[];
  unaffectedDaysCount: number;
  currentAnchorLocation: string;
  remainingDailyBudget: number;
  estimatedDelayMinutes?: number;
}

export interface ReplacementAlternative {
  id: string;
  name: string;
  area: string;
  category: string;
  durationMinutes: number;
  estimatedCost: number;
  distanceFromCurrent: string;
  travelTimeFromCurrent: string;
  reason: string;
  matchedInterests: string[];
  mapsUrl: string;
  startTime?: string;
  endTime?: string;
}

export interface ReplanAuditLog {
  id: string;
  timestamp: string;
  dayNumber: number;
  disruptedActivityName: string;
  disruptionReason: string;
  replacementActivityName?: string;
  actionTaken: 'replaced' | 'removed_and_adjusted';
  summary: string;
}

export interface ReplanResult {
  status: 'ready' | 'error';
  message?: string;
  impact: DisruptionImpactAnalysis;
  alternatives: ReplacementAlternative[];
  explanation: string;
}

export interface ItineraryDay {
  date: string;
  dayNumber: number;
  estimatedDailyCost: number;
  activities: ItineraryActivity[];
}

export interface WhyThisPlan {
  interestsMatch: string;
  paceExplanation: string;
  budgetExplanation: string;
  geographicGrouping: string;
  transportation?: string;
}

export interface TripItinerary {
  id: string;
  tripId: string;
  destination: string;
  summary: string;
  totalEstimatedCost: number;
  dailyBudget: number;
  days: ItineraryDay[];
  whyThisPlan: WhyThisPlan;
  transportation?: GettingThereInfo;
  stayRecommendations?: StayRecommendation[];
  generatedAt: string;
  generationVersion: number;
  planningSnapshot: TripPlanningParameters;
  // Adaptive Disruption & Progress State
  currentDayIndex?: number;
  disruptions?: DisruptionReport[];
  replanLogs?: ReplanAuditLog[];
  lastReplanExplanation?: string;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  dailyBudget: number;
  tripType: TripType;
  adminId: string;
  coAdminId: string | null;
  joinCode: string;
  status: TripStatus;
  planning?: TripPlanningParameters;
  itinerary?: TripItinerary;
  stay?: TripStay | null;
  actualDailyExpenses?: Record<number, number>; // Maps dayNumber (1, 2, 3...) to actual total expenditure
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TripMember {
  uid: string;
  role: TripMemberRole;
  joinedAt?: unknown;
  displayName?: string;
  email?: string;
  photoURL?: string;
}

export interface UserTrip extends Trip {
  userRole: TripMemberRole;
}

export interface CreateTripInput {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  dailyBudget: number;
  tripType: TripType;
  stay?: TripStay | null;
}

export interface SurpriseDestinationSuggestion {
  id: string;
  destination: string;
  region?: string;
  reason: string;
  themes: string[];
  estimatedDailyCost: number;
  estimatedTotalCost: number;
  travelConsiderations: string;
  mapsUrl: string;
}

export interface SurpriseDestinationQuery {
  startingLocation: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  dailyBudget: number;
  travelers: number;
  tripType: TripType;
  travelStyle: TravelStyle;
  interests: TravelInterest[];
  placePreference?: 'popular' | 'hidden_gems' | 'mix';
}


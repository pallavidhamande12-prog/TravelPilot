import {
  Trip,
  UserTrip,
  TripMember,
  TripMemberRole,
  CreateTripInput,
  TripPlanningParameters,
  TripItinerary,
  TripStay,
} from '../types';
import { calculateTripProgress } from '../utils/tripProgress';

const LOCAL_STORAGE_KEY = 'travelpilot_local_trips';
const DEMO_UID = 'demo-traveler-uid';

// Helper to seed initial realistic trips if none exist
function getInitialSeedTrips(): Trip[] {
  const kyotoItinerary: TripItinerary = {
    id: 'plan-kyoto-seed',
    tripId: 'demo-trip-1',
    destination: 'Kyoto, Japan',
    summary:
      'A harmonious 5-day cultural and culinary exploration of ancient temples, bamboo groves, and traditional tea houses in Kyoto.',
    totalEstimatedCost: 1100,
    dailyBudget: 220,
    generatedAt: new Date().toISOString(),
    generationVersion: 1,
    planningSnapshot: {
      origin: 'Tokyo, Japan',
      destination: 'Kyoto, Japan',
      startDate: '2026-10-10',
      endDate: '2026-10-14',
      travelers: 2,
      tripType: 'Couple',
      dailyBudget: 220,
      interests: ['Food', 'History & Culture', 'Photography', 'Nature'],
      travelStyle: 'Balanced',
      preferPopular: true,
      preferHiddenGems: true,
      minimizeTravelTime: true,
      preferLowerCost: false,
    },
    whyThisPlan: {
      interestsMatch: 'Perfect balance of historical UNESCO temples, authentic culinary spots, and tranquil bamboo paths.',
      paceExplanation: 'Comfortable schedule with 3 key stops per day allowing leisurely exploration and tea breaks.',
      budgetExplanation: 'Daily allocation of ~$220 easily covers temple admission tickets, local transit passes, and kaiseki/ramen dining.',
      geographicGrouping: 'Grouped strictly by district (Higashiyama, Arashiyama, and Central Kyoto) to minimize transit.',
      transportation: 'Subway, Keihan line trains, and short walks.',
    },
    days: [
      {
        dayNumber: 1,
        date: '2026-10-10',
        estimatedDailyCost: 190,
        activities: [
          {
            candidateId: 'act-kyoto-1-1',
            name: 'Fushimi Inari Taisha Shrine Torii Walk',
            area: 'Fushimi Ward, Kyoto',
            category: 'sightseeing',
            startTime: '08:30',
            endTime: '10:30',
            durationMinutes: 120,
            estimatedCost: 0,
            travelTimeFromPrevious: '0 min',
            mapsUrl: 'https://maps.google.com/?q=Fushimi+Inari+Taisha+Kyoto',
            reason: 'Iconic morning torii gate hike before midday tour buses arrive.',
            status: 'completed',
          },
          {
            candidateId: 'act-kyoto-1-2',
            name: 'Nishiki Market Street Food Tour',
            area: 'Nakagyo Ward, Kyoto',
            category: 'dining',
            startTime: '11:15',
            endTime: '12:45',
            durationMinutes: 90,
            estimatedCost: 35,
            travelTimeFromPrevious: '25 min via subway',
            mapsUrl: 'https://maps.google.com/?q=Nishiki+Market+Kyoto',
            reason: 'Kyoto’s vibrant "kitchen" offering skewers, matcha treats, and fresh snacks.',
            status: 'completed',
          },
          {
            candidateId: 'act-kyoto-1-3',
            name: 'Gion Lantern Walk & Pontocho Alley Dinner',
            area: 'Gion & Pontocho, Kyoto',
            category: 'dining',
            startTime: '18:00',
            endTime: '20:00',
            durationMinutes: 120,
            estimatedCost: 65,
            travelTimeFromPrevious: '15 min walk',
            mapsUrl: 'https://maps.google.com/?q=Pontocho+Alley+Kyoto',
            reason: 'Evening riverside dinner and historic stone-paved teahouse exploration.',
            status: 'planned',
          },
        ],
      },
      {
        dayNumber: 2,
        date: '2026-10-11',
        estimatedDailyCost: 215,
        activities: [
          {
            candidateId: 'act-kyoto-2-1',
            name: 'Kiyomizu-dera Temple & Wooden Stage',
            area: 'Higashiyama, Kyoto',
            category: 'sightseeing',
            startTime: '09:00',
            endTime: '11:00',
            durationMinutes: 120,
            estimatedCost: 15,
            travelTimeFromPrevious: '20 min walk',
            mapsUrl: 'https://maps.google.com/?q=Kiyomizu-dera+Kyoto',
            reason: 'Clifftop temple with sweeping panoramic vistas across the entire Kyoto valley.',
            status: 'planned',
          },
          {
            candidateId: 'act-kyoto-2-2',
            name: 'Ninenzaka & Sannenzaka Preservation Streets',
            area: 'Higashiyama, Kyoto',
            category: 'leisure',
            startTime: '11:30',
            endTime: '13:00',
            durationMinutes: 90,
            estimatedCost: 20,
            travelTimeFromPrevious: '5 min walk',
            mapsUrl: 'https://maps.google.com/?q=Ninenzaka+Kyoto',
            reason: 'Historic pedestrian lanes lined with wooden merchant shops and artisanal crafts.',
            status: 'planned',
          },
          {
            candidateId: 'act-kyoto-2-3',
            name: 'Kodai-ji Zen Rock Garden & Evening Illumination',
            area: 'Higashiyama, Kyoto',
            category: 'leisure',
            startTime: '18:30',
            endTime: '20:00',
            durationMinutes: 90,
            estimatedCost: 25,
            travelTimeFromPrevious: '15 min walk',
            mapsUrl: 'https://maps.google.com/?q=Kodai-ji+Kyoto',
            reason: 'Atmospheric evening stroll through illuminated bamboo groves and rock gardens.',
            status: 'planned',
          },
        ],
      },
    ],
  };

  return [
    {
      id: 'demo-trip-1',
      name: 'Kyoto Cultural & Culinary Explorer',
      destination: 'Kyoto, Japan',
      startDate: '2026-10-10',
      endDate: '2026-10-14',
      dailyBudget: 220,
      tripType: 'Couple',
      adminId: DEMO_UID,
      coAdminId: null,
      joinCode: 'KYOTO8',
      status: 'Active',
      planning: {
        origin: 'Tokyo, Japan',
        destination: 'Kyoto, Japan',
        startDate: '2026-10-10',
        endDate: '2026-10-14',
        travelers: 2,
        tripType: 'Couple',
        dailyBudget: 220,
        interests: ['Food', 'History & Culture', 'Photography', 'Nature'],
        travelStyle: 'Balanced',
        preferPopular: true,
        preferHiddenGems: true,
        minimizeTravelTime: true,
        preferLowerCost: false,
      },
      itinerary: kyotoItinerary,
      stay: {
        mode: 'existing',
        name: 'The Celestine Hotel Kyoto Gion',
        address: 'Higashiyama Ward, Kyoto',
        checkInDate: '2026-10-10',
        checkOutDate: '2026-10-14',
        bookingNote: 'Confirmation: CEL-9921',
      },
      actualDailyExpenses: {
        1: 95,
      },
      createdAt: '2026-09-20T10:00:00Z',
      updatedAt: '2026-09-20T10:00:00Z',
    },
    {
      id: 'demo-trip-2',
      name: 'Amalfi Coast Scenic Getaway',
      destination: 'Amalfi Coast, Italy',
      startDate: '2026-11-04',
      endDate: '2026-11-08',
      dailyBudget: 340,
      tripType: 'Friends',
      adminId: DEMO_UID,
      coAdminId: null,
      joinCode: 'AMALF4',
      status: 'Planning',
      planning: {
        origin: 'Rome, Italy',
        destination: 'Amalfi Coast, Italy',
        startDate: '2026-11-04',
        endDate: '2026-11-08',
        travelers: 3,
        tripType: 'Friends',
        dailyBudget: 340,
        interests: ['Nature', 'Food', 'Photography', 'Relaxation'],
        travelStyle: 'Balanced',
        preferPopular: true,
        preferHiddenGems: true,
        minimizeTravelTime: false,
        preferLowerCost: false,
      },
      createdAt: '2026-09-20T12:00:00Z',
      updatedAt: '2026-09-20T12:00:00Z',
    },
  ];
}

// Load all trips from localStorage
export function loadLocalTrips(): Trip[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      const initial = getInitialSeedTrips();
      saveLocalTrips(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const initial = getInitialSeedTrips();
      saveLocalTrips(initial);
      return initial;
    }
    return parsed;
  } catch (err) {
    console.warn('Failed to parse local trips, resetting with seeds:', err);
    const initial = getInitialSeedTrips();
    saveLocalTrips(initial);
    return initial;
  }
}

// Save trips array to localStorage
export function saveLocalTrips(trips: Trip[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trips));
  } catch (err) {
    console.error('Failed to save trips to local storage:', err);
  }
}

// Get user trips list for specific user
export function getLocalUserTrips(userId: string): UserTrip[] {
  const allTrips = loadLocalTrips();
  return allTrips.map((trip) => {
    let role: TripMemberRole = 'member';
    if (trip.adminId === userId || (!trip.adminId && userId === DEMO_UID)) {
      role = 'admin';
    } else if (trip.coAdminId === userId) {
      role = 'co-admin';
    }
    if (trip.itinerary) {
      const stats = calculateTripProgress(trip.itinerary);
      trip.status = stats.derivedStatus;
    }
    return {
      ...trip,
      userRole: role,
    };
  });
}

// Create trip in local store
export function createLocalTrip(
  input: CreateTripInput,
  userId: string
): Trip {
  const allTrips = loadLocalTrips();
  const id = `trip-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let joinCode = '';
  for (let i = 0; i < 6; i++) {
    joinCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const newTrip: Trip = {
    id,
    name: input.name.trim(),
    destination: input.destination.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    dailyBudget: Number(input.dailyBudget),
    tripType: input.tripType,
    adminId: userId,
    coAdminId: null,
    joinCode,
    status: 'Planning',
    stay: input.stay || null,
    actualDailyExpenses: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  allTrips.unshift(newTrip);
  saveLocalTrips(allTrips);
  return newTrip;
}

// Get single trip details with members
export function getLocalTripDetails(
  tripId: string,
  userId: string
): { trip: Trip; userRole: TripMemberRole; members: TripMember[] } {
  const allTrips = loadLocalTrips();
  const trip = allTrips.find((t) => t.id === tripId);
  if (!trip) {
    throw new Error('Trip not found.');
  }

  if (trip.itinerary) {
    const stats = calculateTripProgress(trip.itinerary);
    trip.status = stats.derivedStatus;
  }

  let userRole: TripMemberRole = 'member';
  if (trip.adminId === userId || trip.adminId === DEMO_UID) {
    userRole = 'admin';
  } else if (trip.coAdminId === userId) {
    userRole = 'co-admin';
  }

  const members: TripMember[] = [
    {
      uid: trip.adminId || DEMO_UID,
      role: 'admin',
      displayName: 'Alex Morgan',
      email: 'alex.traveler@example.com',
      joinedAt: trip.createdAt,
    },
  ];

  if (trip.coAdminId) {
    members.push({
      uid: trip.coAdminId,
      role: 'co-admin',
      displayName: 'Co-Traveler',
      joinedAt: trip.updatedAt,
    });
  }

  return { trip, userRole, members };
}

// Update trip in local store
export function updateLocalTrip(
  tripId: string,
  updater: (trip: Trip) => Trip
): Trip {
  const allTrips = loadLocalTrips();
  const index = allTrips.findIndex((t) => t.id === tripId);
  if (index === -1) {
    throw new Error('Trip not found.');
  }

  const updated = updater({ ...allTrips[index] });
  updated.updatedAt = new Date().toISOString();
  if (updated.itinerary) {
    const stats = calculateTripProgress(updated.itinerary);
    updated.status = stats.derivedStatus;
  }

  allTrips[index] = updated;
  saveLocalTrips(allTrips);
  return updated;
}

// Delete trip from local store
export function deleteLocalTrip(tripId: string): void {
  const allTrips = loadLocalTrips();
  const filtered = allTrips.filter((t) => t.id !== tripId);
  saveLocalTrips(filtered);
}

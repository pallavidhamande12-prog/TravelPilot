import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  collectionGroup,
} from 'firebase/firestore';
import { db } from './firebase';
import { Trip, TripMember, UserTrip, CreateTripInput, TripMemberRole, TripPlanningParameters, TripItinerary, TripStay } from '../types';
import { calculateTripProgress } from '../utils/tripProgress';
import {
  createLocalTrip,
  deleteLocalTrip,
  getLocalTripDetails,
  getLocalUserTrips,
  loadLocalTrips,
  updateLocalTrip,
} from './localTripStore';

/**
 * Remove or sanitize undefined fields so Firestore serialization never throws
 * 'Unsupported field value: undefined'.
 */
function cleanUndefinedFields<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, val) => (val === undefined ? null : val)));
}

/**
 * Generate a short, uppercase, easy-to-type, random join code.
 * Excludes easily confused characters (I, O, 0, 1).
 */
export function generateRandomCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Ensures join code is unique among active trips.
 */
async function generateUniqueJoinCode(): Promise<string> {
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateRandomCode(6);
      const q = query(
        collection(db, 'trips'),
        where('joinCode', '==', candidate)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        return candidate;
      }
    }
  } catch {
    // If Firestore query fails (e.g. referer blocked or offline), return random candidate
  }
  return generateRandomCode(4) + Math.floor(10 + Math.random() * 89);
}

/**
 * Create a new trip in Firestore (or local store in demo/fallback mode).
 *
 * Rules:
 * - adminId = Firebase UID of creator
 * - coAdminId = null initially
 * - status = "Planning" initially
 * - Unique join code generated
 * - Creator automatically gets a member document with role = "admin"
 */
export async function createTrip(
  input: CreateTripInput,
  userId: string,
  userDisplayName?: string,
  userPhotoURL?: string
): Promise<Trip> {
  // 1. Validation
  if (!input.name.trim()) throw new Error('Trip name cannot be empty.');
  if (!input.destination.trim()) throw new Error('Destination cannot be empty.');
  if (!input.startDate) throw new Error('Start date is required.');
  if (!input.endDate) throw new Error('End date is required.');
  if (input.endDate < input.startDate) {
    throw new Error('End date cannot be before start date.');
  }
  if (typeof input.dailyBudget !== 'number' || input.dailyBudget <= 0 || isNaN(input.dailyBudget)) {
    throw new Error('Daily budget must be a positive number.');
  }
  if (!input.tripType) throw new Error('Trip type is required.');

  // Demo user mode
  if (userId.startsWith('demo-')) {
    return createLocalTrip(input, userId);
  }

  try {
    // 2. Generate Doc Ref & Join Code
    const tripRef = doc(collection(db, 'trips'));
    const joinCode = await generateUniqueJoinCode();

    const tripData: Record<string, unknown> = {
      id: tripRef.id,
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (input.stay) {
      tripData.stay = cleanUndefinedFields(input.stay);
    }

    const memberRef = doc(db, 'trips', tripRef.id, 'members', userId);
    const memberData: Record<string, unknown> = {
      uid: userId,
      role: 'admin',
      displayName: userDisplayName || 'TravelPilot Member',
      photoURL: userPhotoURL || '',
      joinedAt: serverTimestamp(),
    };

    // 3. Atomic Batch Commit
    const batch = writeBatch(db);
    batch.set(tripRef, tripData);
    batch.set(memberRef, memberData);
    await batch.commit();

    return {
      ...(tripData as unknown as Trip),
      id: tripRef.id,
    };
  } catch (err) {
    console.warn('Firestore createTrip failed, saving to local trip store:', err);
    return createLocalTrip(input, userId);
  }
}

/**
 * Query trips accessible to the authenticated user.
 * 
 * Requirement 11:
 * My Trips must show:
 * - trips where the authenticated user is the admin
 * - trips where the authenticated user has a member document
 */
export async function getUserTrips(userId: string): Promise<UserTrip[]> {
  if (userId.startsWith('demo-')) {
    return getLocalUserTrips(userId);
  }

  const tripMap = new Map<string, UserTrip>();

  try {
    // 1. Query membership documents via collectionGroup
    const membersQuery = query(
      collectionGroup(db, 'members'),
      where('uid', '==', userId)
    );
    const membersSnap = await getDocs(membersQuery);

    for (const memberDoc of membersSnap.docs) {
      const tripRef = memberDoc.ref.parent.parent;
      if (!tripRef) continue;

      const tripSnap = await getDoc(tripRef);
      if (tripSnap.exists()) {
        const tripData = tripSnap.data() as Trip;
        const role = memberDoc.data().role as TripMemberRole;
        if (tripData.itinerary) {
          const stats = calculateTripProgress(tripData.itinerary);
          tripData.status = stats.derivedStatus;
        }
        tripMap.set(tripSnap.id, {
          ...tripData,
          id: tripSnap.id,
          userRole: role,
        });
      }
    }
  } catch (err) {
    console.warn('CollectionGroup query on members note/fallback:', err);
  }

  // 2. Query trips where user is explicitly adminId (guarantees creator trips always appear)
  try {
    const adminQuery = query(
      collection(db, 'trips'),
      where('adminId', '==', userId)
    );
    const adminSnap = await getDocs(adminQuery);

    for (const tripDoc of adminSnap.docs) {
      if (!tripMap.has(tripDoc.id)) {
        const tripData = tripDoc.data() as Trip;
        if (tripData.itinerary) {
          const stats = calculateTripProgress(tripData.itinerary);
          tripData.status = stats.derivedStatus;
        }
        tripMap.set(tripDoc.id, {
          ...tripData,
          id: tripDoc.id,
          userRole: 'admin',
        });
      }
    }
  } catch (err) {
    console.error('Error fetching admin trips:', err);
  }

  const trips = Array.from(tripMap.values());
  if (trips.length === 0) {
    // Check if user has any local trips created while offline
    const local = getLocalUserTrips(userId);
    if (local.length > 0) {
      return local;
    }
  }

  // Sort by start date (soonest first)
  trips.sort((a, b) => (a.startDate > b.startDate ? 1 : -1));

  return trips;
}

/**
 * Join an existing trip with a join code.
 *
 * Rules:
 * - Code must be valid and match an existing trip.
 * - Add user to trips/{tripId}/members/{uid} with role = "member".
 * - Do not change admin or co-admin.
 * - Do not overwrite existing member records.
 * - If already a member, inform the user cleanly.
 */
export async function joinTripWithCode(
  rawCode: string,
  userId: string,
  userDisplayName?: string,
  userPhotoURL?: string
): Promise<{ status: 'joined' | 'already_member'; trip: Trip; role: TripMemberRole }> {
  const cleanCode = rawCode.trim().toUpperCase();
  if (!cleanCode) {
    throw new Error('Please enter a valid trip code.');
  }

  // Check local trips first (for demo or local mode)
  try {
    const localTrips = loadLocalTrips();
    const localTrip = localTrips.find((t: Trip) => t.joinCode === cleanCode);
    if (localTrip) {
      return {
        status: 'joined',
        trip: localTrip,
        role: localTrip.adminId === userId ? 'admin' : 'member',
      };
    }
  } catch {
    // Ignore local check error
  }

  try {
    // Query for trip with joinCode
    const q = query(
      collection(db, 'trips'),
      where('joinCode', '==', cleanCode)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      throw new Error('Invalid trip code. Please check the code and try again.');
    }

    const tripDoc = snap.docs[0];
    const trip = { ...tripDoc.data(), id: tripDoc.id } as Trip;

    // Check existing membership
    const memberRef = doc(db, 'trips', trip.id, 'members', userId);
    const memberSnap = await getDoc(memberRef);

    if (memberSnap.exists()) {
      const existingRole = memberSnap.data().role as TripMemberRole;
      return {
        status: 'already_member',
        trip,
        role: existingRole,
      };
    }

    // If user is creator (adminId), set as admin, otherwise regular member
    const role: TripMemberRole = trip.adminId === userId ? 'admin' : 'member';

    await setDoc(memberRef, {
      uid: userId,
      role,
      displayName: userDisplayName || 'TravelPilot Member',
      photoURL: userPhotoURL || '',
      joinedAt: serverTimestamp(),
    });

    return {
      status: 'joined',
      trip,
      role,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('Invalid trip code')) {
      throw err;
    }
    console.warn('Firestore joinTripWithCode failed:', err);
    throw new Error('Could not join trip with this code. Please check and try again.');
  }
}

/**
 * Fetch a single trip by ID along with the user's role and human-readable members.
 */
export async function getTripDetails(
  tripId: string,
  userId: string
): Promise<{ trip: Trip; userRole: TripMemberRole; members: TripMember[] }> {
  if (userId.startsWith('demo-') || tripId.startsWith('trip-') || tripId.startsWith('demo-')) {
    try {
      return getLocalTripDetails(tripId, userId);
    } catch {
      // Fall through to Firestore
    }
  }

  try {
    const tripRef = doc(db, 'trips', tripId);
    const tripSnap = await getDoc(tripRef);

    if (!tripSnap.exists()) {
      return getLocalTripDetails(tripId, userId);
    }

    const trip = { ...tripSnap.data(), id: tripSnap.id } as Trip;
    if (trip.itinerary) {
      const stats = calculateTripProgress(trip.itinerary);
      trip.status = stats.derivedStatus;
    }

    // Fetch current user's role from members subcollection
    const myMemberRef = doc(db, 'trips', tripId, 'members', userId);
    const myMemberSnap = await getDoc(myMemberRef);

    let userRole: TripMemberRole = 'member';
    if (myMemberSnap.exists()) {
      userRole = myMemberSnap.data().role as TripMemberRole;
    } else if (trip.adminId === userId) {
      userRole = 'admin';
    } else if (trip.coAdminId === userId) {
      userRole = 'co-admin';
    } else {
      userRole = 'member';
    }

    // Fetch all trip members
    const membersRef = collection(db, 'trips', tripId, 'members');
    const membersSnap = await getDocs(membersRef);

    const memberPromises = membersSnap.docs.map(async (d) => {
      const data = d.data();
      let displayName = (data.displayName as string | undefined)?.trim();
      let photoURL = data.photoURL as string | undefined;

      // Fetch user profile from users/{uid} for fresh displayName if available
      try {
        const userDocRef = doc(db, 'users', d.id);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const uData = userDocSnap.data();
          if (uData.displayName && uData.displayName.trim()) {
            displayName = uData.displayName.trim();
          }
          if (uData.photoURL) {
            photoURL = uData.photoURL;
          }
        }
      } catch {
        // Graceful fallback to member document or default
      }

      // Explicit fallback: if member's displayName is unavailable, use "TravelPilot Member"
      // Never display Firebase UID as visible name
      const finalDisplayName = displayName || 'TravelPilot Member';

      return {
        uid: d.id,
        role: data.role as TripMemberRole,
        displayName: finalDisplayName,
        photoURL: photoURL || undefined,
        joinedAt: data.joinedAt,
      };
    });

    const members: TripMember[] = await Promise.all(memberPromises);

    return { trip, userRole, members };
  } catch (err) {
    console.warn('Firestore getTripDetails failed, attempting local fallback:', err);
    return getLocalTripDetails(tripId, userId);
  }
}

/**
 * Save planning parameters inside the existing trip document under trips/{tripId}.
 * Sets the `planning` object and synchronizes primary trip parameters
 * without breaking existing trip fields.
 */
export async function saveTripPlanningParameters(
  tripId: string,
  planning: TripPlanningParameters
): Promise<Trip> {
  // Validate required fields
  if (!planning.destination?.trim()) {
    throw new Error('Destination is required.');
  }
  if (!planning.startDate) {
    throw new Error('Start date is required.');
  }
  if (!planning.endDate) {
    throw new Error('End date is required.');
  }
  if (planning.endDate < planning.startDate) {
    throw new Error('End date cannot be before start date.');
  }
  if (typeof planning.dailyBudget !== 'number' || planning.dailyBudget <= 0 || isNaN(planning.dailyBudget)) {
    throw new Error('Daily budget must be a positive number.');
  }
  if (!planning.tripType) {
    throw new Error('Trip type is required.');
  }
  if (!planning.travelers || planning.travelers < 1) {
    throw new Error('Number of travelers must be at least 1.');
  }
  if (!planning.travelStyle) {
    throw new Error('Travel style is required.');
  }

  if (tripId.startsWith('trip-') || tripId.startsWith('demo-')) {
    return updateLocalTrip(tripId, (trip) => ({
      ...trip,
      planning,
      destination: planning.destination.trim(),
      startDate: planning.startDate,
      endDate: planning.endDate,
      dailyBudget: Number(planning.dailyBudget),
      tripType: planning.tripType,
      stay: planning.stay !== undefined ? planning.stay : trip.stay,
    }));
  }

  try {
    const tripRef = doc(db, 'trips', tripId);
    const tripSnap = await getDoc(tripRef);

    if (!tripSnap.exists()) {
      return updateLocalTrip(tripId, (trip) => ({
        ...trip,
        planning,
        destination: planning.destination.trim(),
        startDate: planning.startDate,
        endDate: planning.endDate,
        dailyBudget: Number(planning.dailyBudget),
        tripType: planning.tripType,
        stay: planning.stay !== undefined ? planning.stay : trip.stay,
      }));
    }

    const planningData: Record<string, unknown> = {
      origin: planning.origin?.trim() || '',
      destination: planning.destination.trim(),
      region: planning.region?.trim() || '',
      startDate: planning.startDate,
      endDate: planning.endDate,
      travelers: Number(planning.travelers),
      tripType: planning.tripType,
      dailyBudget: Number(planning.dailyBudget),
      interests: planning.interests || [],
      travelStyle: planning.travelStyle,
      preferPopular: Boolean(planning.preferPopular),
      preferHiddenGems: Boolean(planning.preferHiddenGems),
      preferPlacesCloseTogether: Boolean(planning.preferPlacesCloseTogether),
      minimizeTravelTime: Boolean(planning.minimizeTravelTime),
      preferLowerCost: Boolean(planning.preferLowerCost),
      stay: planning.stay ? cleanUndefinedFields(planning.stay) : null,
      updatedAt: serverTimestamp(),
    };

    const tripUpdates: Record<string, unknown> = {
      planning: planningData,
      destination: planning.destination.trim(),
      startDate: planning.startDate,
      endDate: planning.endDate,
      dailyBudget: Number(planning.dailyBudget),
      tripType: planning.tripType,
      updatedAt: serverTimestamp(),
    };

    if (planning.stay !== undefined) {
      tripUpdates.stay = planning.stay ? cleanUndefinedFields(planning.stay) : null;
    }

    await updateDoc(tripRef, tripUpdates);

    const updatedSnap = await getDoc(tripRef);
    return { ...updatedSnap.data(), id: updatedSnap.id } as Trip;
  } catch (err) {
    console.warn('Firestore saveTripPlanningParameters failed, saving to local store:', err);
    return updateLocalTrip(tripId, (trip) => ({
      ...trip,
      planning,
      destination: planning.destination.trim(),
      startDate: planning.startDate,
      endDate: planning.endDate,
      dailyBudget: Number(planning.dailyBudget),
      tripType: planning.tripType,
      stay: planning.stay !== undefined ? planning.stay : trip.stay,
    }));
  }
}

/**
 * Save generated or updated itinerary inside trips/{tripId}.itinerary.
 * Maintains atomic synchronization with the trip's updatedAt timestamp.
 */
export async function saveTripItinerary(
  tripId: string,
  itinerary: TripItinerary
): Promise<Trip> {
  const cleanItinerary = cleanUndefinedFields(itinerary);

  if (tripId.startsWith('trip-') || tripId.startsWith('demo-')) {
    return updateLocalTrip(tripId, (trip) => ({
      ...trip,
      itinerary: cleanItinerary,
    }));
  }

  try {
    const tripRef = doc(db, 'trips', tripId);
    const tripSnap = await getDoc(tripRef);

    if (!tripSnap.exists()) {
      return updateLocalTrip(tripId, (trip) => ({
        ...trip,
        itinerary: cleanItinerary,
      }));
    }

    const stats = calculateTripProgress(cleanItinerary);

    await updateDoc(tripRef, {
      itinerary: cleanItinerary,
      status: stats.derivedStatus,
      updatedAt: serverTimestamp(),
    });

    const updatedSnap = await getDoc(tripRef);
    return {
      ...updatedSnap.data(),
      id: updatedSnap.id,
      status: stats.derivedStatus,
    } as Trip;
  } catch (err) {
    console.warn('Firestore saveTripItinerary failed, saving to local store:', err);
    return updateLocalTrip(tripId, (trip) => ({
      ...trip,
      itinerary: cleanItinerary,
    }));
  }
}

/**
 * Update trip name in Firestore trips/{tripId}.
 * Enforces admin / co-admin permission check.
 * Only modifies the 'name' field and updatedAt timestamp.
 */
export async function updateTripName(
  tripId: string,
  newName: string,
  userId: string
): Promise<Trip> {
  const cleanName = newName.trim();
  if (!cleanName) {
    throw new Error('Trip name cannot be empty.');
  }

  if (userId.startsWith('demo-') || tripId.startsWith('trip-') || tripId.startsWith('demo-')) {
    return updateLocalTrip(tripId, (trip) => ({
      ...trip,
      name: cleanName,
    }));
  }

  try {
    const tripRef = doc(db, 'trips', tripId);
    const tripSnap = await getDoc(tripRef);

    if (!tripSnap.exists()) {
      return updateLocalTrip(tripId, (trip) => ({
        ...trip,
        name: cleanName,
      }));
    }

    const tripData = tripSnap.data() as Trip;

    const isCreatorAdmin = tripData.adminId === userId;
    const isCoAdmin = tripData.coAdminId === userId;

    let userRole: TripMemberRole = isCreatorAdmin ? 'admin' : isCoAdmin ? 'co-admin' : 'member';
    const memberRef = doc(db, 'trips', tripId, 'members', userId);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
      userRole = memberSnap.data().role as TripMemberRole;
    }

    if (userRole !== 'admin' && userRole !== 'co-admin') {
      throw new Error('Only trip admins and co-admins can edit the trip name.');
    }

    await updateDoc(tripRef, {
      name: cleanName,
      updatedAt: serverTimestamp(),
    });

    const updatedSnap = await getDoc(tripRef);
    return {
      ...updatedSnap.data(),
      id: updatedSnap.id,
    } as Trip;
  } catch (err) {
    console.warn('Firestore updateTripName failed, updating locally:', err);
    return updateLocalTrip(tripId, (trip) => ({
      ...trip,
      name: cleanName,
    }));
  }
}

/**
 * Permanently delete a trip and its subcollections from Firestore.
 * Admin-only permission check.
 * Cleans up all member subcollection documents and the trip document itself.
 */
export async function deleteTrip(tripId: string, userId: string): Promise<void> {
  if (userId.startsWith('demo-') || tripId.startsWith('trip-') || tripId.startsWith('demo-')) {
    deleteLocalTrip(tripId);
    return;
  }

  try {
    const tripRef = doc(db, 'trips', tripId);
    const tripSnap = await getDoc(tripRef);

    if (!tripSnap.exists()) {
      deleteLocalTrip(tripId);
      return;
    }

    const tripData = tripSnap.data() as Trip;

    let isAuthorizedAdmin = tripData.adminId === userId;
    if (!isAuthorizedAdmin) {
      const memberRef = doc(db, 'trips', tripId, 'members', userId);
      const memberSnap = await getDoc(memberRef);
      if (memberSnap.exists() && memberSnap.data().role === 'admin') {
        isAuthorizedAdmin = true;
      }
    }

    if (!isAuthorizedAdmin) {
      throw new Error('Only the trip admin can delete this trip.');
    }

    const membersRef = collection(db, 'trips', tripId, 'members');
    const membersSnap = await getDocs(membersRef);

    const batch = writeBatch(db);
    for (const mDoc of membersSnap.docs) {
      batch.delete(mDoc.ref);
    }
    batch.delete(tripRef);

    await batch.commit();
  } catch (err) {
    console.warn('Firestore deleteTrip failed, deleting locally:', err);
    deleteLocalTrip(tripId);
  }
}

/**
 * Update stay/accommodation in Firestore trips/{tripId}.
 * Enforces admin / co-admin permission check.
 * Updates trips/{tripId}.stay, trips/{tripId}.updatedAt, and synchronizes with
 * planning.stay and itinerary.planningSnapshot.stay if they exist.
 * Preserves the existing itinerary without requiring re-generation.
 */
export async function updateTripStay(
  tripId: string,
  stay: TripStay,
  userId: string
): Promise<Trip> {
  const cleanStay = cleanUndefinedFields(stay);

  if (userId.startsWith('demo-') || tripId.startsWith('trip-') || tripId.startsWith('demo-')) {
    return updateLocalTrip(tripId, (trip) => ({
      ...trip,
      stay: cleanStay,
    }));
  }

  try {
    const tripRef = doc(db, 'trips', tripId);
    const tripSnap = await getDoc(tripRef);

    if (!tripSnap.exists()) {
      return updateLocalTrip(tripId, (trip) => ({
        ...trip,
        stay: cleanStay,
      }));
    }

    const tripData = tripSnap.data() as Trip;

    const isCreatorAdmin = tripData.adminId === userId;
    const isCoAdmin = tripData.coAdminId === userId;

    let userRole: TripMemberRole = isCreatorAdmin ? 'admin' : isCoAdmin ? 'co-admin' : 'member';
    const memberRef = doc(db, 'trips', tripId, 'members', userId);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
      userRole = memberSnap.data().role as TripMemberRole;
    }

    if (userRole !== 'admin' && userRole !== 'co-admin') {
      throw new Error('Only trip admins and co-admins can manage accommodation details.');
    }

    const updates: Record<string, unknown> = {
      stay: cleanStay,
      updatedAt: serverTimestamp(),
    };

    if (tripData.planning) {
      updates['planning.stay'] = cleanStay;
    }
    if (tripData.itinerary && tripData.itinerary.planningSnapshot) {
      updates['itinerary.planningSnapshot.stay'] = cleanStay;
    }

    await updateDoc(tripRef, updates);

    const updatedSnap = await getDoc(tripRef);
    return {
      ...updatedSnap.data(),
      id: updatedSnap.id,
    } as Trip;
  } catch (err) {
    console.warn('Firestore updateTripStay failed, saving locally:', err);
    return updateLocalTrip(tripId, (trip) => ({
      ...trip,
      stay: cleanStay,
    }));
  }
}

/**
 * Remove stay/accommodation from Firestore trips/{tripId}.
 * Enforces admin / co-admin permission check.
 * Clears stay from trip root, planning, and itinerary planningSnapshot.
 */
export async function removeTripStay(
  tripId: string,
  userId: string
): Promise<Trip> {
  if (userId.startsWith('demo-') || tripId.startsWith('trip-') || tripId.startsWith('demo-')) {
    return updateLocalTrip(tripId, (trip) => ({
      ...trip,
      stay: null,
    }));
  }

  try {
    const tripRef = doc(db, 'trips', tripId);
    const tripSnap = await getDoc(tripRef);

    if (!tripSnap.exists()) {
      return updateLocalTrip(tripId, (trip) => ({
        ...trip,
        stay: null,
      }));
    }

    const tripData = tripSnap.data() as Trip;

    const isCreatorAdmin = tripData.adminId === userId;
    const isCoAdmin = tripData.coAdminId === userId;

    let userRole: TripMemberRole = isCreatorAdmin ? 'admin' : isCoAdmin ? 'co-admin' : 'member';
    const memberRef = doc(db, 'trips', tripId, 'members', userId);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
      userRole = memberSnap.data().role as TripMemberRole;
    }

    if (userRole !== 'admin' && userRole !== 'co-admin') {
      throw new Error('Only trip admins and co-admins can manage accommodation details.');
    }

    const updates: Record<string, unknown> = {
      stay: null,
      updatedAt: serverTimestamp(),
    };

    if (tripData.planning) {
      updates['planning.stay'] = null;
    }
    if (tripData.itinerary && tripData.itinerary.planningSnapshot) {
      updates['itinerary.planningSnapshot.stay'] = null;
    }

    await updateDoc(tripRef, updates);

    const updatedSnap = await getDoc(tripRef);
    return {
      ...updatedSnap.data(),
      id: updatedSnap.id,
    } as Trip;
  } catch (err) {
    console.warn('Firestore removeTripStay failed, clearing locally:', err);
    return updateLocalTrip(tripId, (trip) => ({
      ...trip,
      stay: null,
    }));
  }
}

/**
 * Update actual daily expenditure for a specific day in Firestore trips/{tripId}.
 * Enforces member / editor permission check (trip members, co-admins, and admins can log expenses).
 * Stores actual expenditure under `actualDailyExpenses.{dayNumber}` separately from estimated budget.
 */
export async function updateDailyActualExpense(
  tripId: string,
  dayNumber: number,
  actualAmount: number,
  userId: string
): Promise<Trip> {
  if (isNaN(dayNumber) || dayNumber < 1) {
    throw new Error('Invalid day number.');
  }
  if (isNaN(actualAmount) || actualAmount < 0) {
    throw new Error('Expenditure amount must be a positive number or zero.');
  }

  if (userId.startsWith('demo-') || tripId.startsWith('trip-') || tripId.startsWith('demo-')) {
    return updateLocalTrip(tripId, (trip) => {
      const existingExpenses = (trip.actualDailyExpenses || {}) as Record<string | number, number>;
      const updatedExpenses: Record<string, number> = {};
      Object.keys(existingExpenses).forEach((key) => {
        updatedExpenses[key] = Number(existingExpenses[key]);
      });
      updatedExpenses[String(dayNumber)] = Number(actualAmount);
      return {
        ...trip,
        actualDailyExpenses: updatedExpenses,
      };
    });
  }

  try {
    const tripRef = doc(db, 'trips', tripId);
    const tripSnap = await getDoc(tripRef);

    if (!tripSnap.exists()) {
      return updateLocalTrip(tripId, (trip) => {
        const existingExpenses = (trip.actualDailyExpenses || {}) as Record<string | number, number>;
        const updatedExpenses: Record<string, number> = {};
        Object.keys(existingExpenses).forEach((key) => {
          updatedExpenses[key] = Number(existingExpenses[key]);
        });
        updatedExpenses[String(dayNumber)] = Number(actualAmount);
        return {
          ...trip,
          actualDailyExpenses: updatedExpenses,
        };
      });
    }

    const tripData = tripSnap.data() as Trip;

    const isCreatorAdmin = tripData.adminId === userId;
    const isCoAdmin = tripData.coAdminId === userId;
    let isAuthorized = isCreatorAdmin || isCoAdmin;

    if (!isAuthorized) {
      const memberRef = doc(db, 'trips', tripId, 'members', userId);
      const memberSnap = await getDoc(memberRef);
      if (memberSnap.exists()) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new Error('Only trip members and organizers can update trip expenses.');
    }

    const existingExpenses = (tripData.actualDailyExpenses || {}) as Record<string | number, number>;
    const updatedExpenses: Record<string, number> = {};

    Object.keys(existingExpenses).forEach((key) => {
      updatedExpenses[key] = Number(existingExpenses[key]);
    });
    updatedExpenses[String(dayNumber)] = Number(actualAmount);

    await updateDoc(tripRef, {
      actualDailyExpenses: updatedExpenses,
      updatedAt: serverTimestamp(),
    });

    const updatedDocSnap = await getDoc(tripRef);
    return {
      ...updatedDocSnap.data(),
      id: updatedDocSnap.id,
    } as Trip;
  } catch (err) {
    console.warn('Firestore updateDailyActualExpense failed, updating locally:', err);
    return updateLocalTrip(tripId, (trip) => {
      const existingExpenses = (trip.actualDailyExpenses || {}) as Record<string | number, number>;
      const updatedExpenses: Record<string, number> = {};
      Object.keys(existingExpenses).forEach((key) => {
        updatedExpenses[key] = Number(existingExpenses[key]);
      });
      updatedExpenses[String(dayNumber)] = Number(actualAmount);
      return {
        ...trip,
        actualDailyExpenses: updatedExpenses,
      };
    });
  }
}





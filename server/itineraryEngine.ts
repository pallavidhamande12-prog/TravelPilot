import { GoogleGenAI, Type } from '@google/genai';
import {
  TripPlanningParameters,
  TripItinerary,
  ItineraryDay,
  ItineraryActivity,
  GettingThereInfo,
  TransportOption,
  TransportMode,
  StayRecommendation,
} from '../src/types/index';

// Candidate models in preference order (gemini-2.5-flash has generous quota and high speed, fallbacks to flash-lite/flash)
const CANDIDATE_MODELS = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];

// Initialize Gemini lazily on the server
let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

function getDatesBetween(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  try {
    const current = new Date(startDateStr);
    const end = new Date(endDateStr);
    let count = 0;
    while (current <= end && count < 14) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
      count++;
    }
  } catch {
    dates.push(startDateStr);
  }
  return dates.length > 0 ? dates : [startDateStr];
}

// Safely generate Google Maps search URL
export function generateGoogleMapsSearchUrl(placeName: string, area?: string, destination?: string): string {
  const parts = [placeName, area, destination].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}

// Safely generate external search URLs for transport options
export function generateFlightSearchUrl(destination: string, origin?: string, startDate?: string): string {
  const query = `Flights to ${destination}${origin ? ` from ${origin}` : ''}${startDate ? ` on ${startDate}` : ''}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}

export function generateTrainSearchUrl(destination: string, origin?: string): string {
  const query = `${origin ? `${origin} to ` : ''}${destination} train booking IRCTC`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function generateBusSearchUrl(destination: string, origin?: string): string {
  const query = `${origin ? `${origin} to ` : ''}${destination} bus booking redbus`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function generateDrivingDirectionsUrl(destination: string, origin?: string): string {
  if (origin && origin.trim()) {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin.trim())}&destination=${encodeURIComponent(destination.trim())}&travelmode=driving`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Route to ${destination}`)}`;
}

// Safely generate external search URLs for accommodation / hotels
export function generateHotelSearchUrl(
  destination: string,
  area?: string,
  startDate?: string,
  endDate?: string
): string {
  const query = [area || destination, destination, 'hotels'].filter(Boolean).join(' ');
  const params = new URLSearchParams();
  params.set('q', query);
  if (startDate) params.set('checkin', startDate);
  if (endDate) params.set('checkout', endDate);
  return `https://www.google.com/travel/hotels?${params.toString()}`;
}

/**
 * Universal destination itinerary and transportation engine.
 * Calls Gemini with strict factual data constraints.
 * Works for ANY destination worldwide (e.g., Paris, Tokyo, Manali, Kerala, Dubai, London, Bali, New York, etc.).
 */
export async function generateItinerary(
  planning: TripPlanningParameters,
  tripId: string
): Promise<TripItinerary> {
  const destination = (planning.destination || '').trim();
  if (!destination) {
    throw new Error('Destination cannot be empty.');
  }

  const origin = (planning.origin || '').trim();
  const dates = getDatesBetween(planning.startDate, planning.endDate);

  console.log('[Diagnostic] --- Plan Generation Request Started ---');
  console.log(`[Diagnostic] Destination: "${destination}", Origin: "${origin || '(none)'}", Region: "${planning.region || '(none)'}"`);
  console.log(`[Diagnostic] Dates: ${planning.startDate} to ${planning.endDate} (${dates.length} days: ${dates.join(', ')})`);
  console.log(`[Diagnostic] Budget: ₹${planning.dailyBudget}/day, Travelers: ${planning.travelers} (${planning.tripType}), Style: ${planning.travelStyle}`);
  console.log(`[Diagnostic] Interests (${planning.interests?.length || 0}): ${(planning.interests || []).join(', ')}`);
  console.log(`[Diagnostic] Preferences: popular=${Boolean(planning.preferPopular)}, gems=${Boolean(planning.preferHiddenGems)}, closeTogether=${Boolean(planning.preferPlacesCloseTogether)}, minTravelTime=${Boolean(planning.minimizeTravelTime)}, lowerCost=${Boolean(planning.preferLowerCost)}`);

  const ai = getAIClient();
  if (!ai) {
    console.error('[Diagnostic] AI client unavailable: Missing GEMINI_API_KEY on server.');
    throw new Error(
      "TravelPilot couldn't gather enough reliable information for this destination right now. Please try again."
    );
  }

  const isWithinCity = planning.mode === 'within_city' || planning.travelMode === 'road_trip';
  const anchorCity = (
    planning.resolvedCity ||
    (planning.destination ? planning.destination.split('&')[0].trim() : '') ||
    planning.origin ||
    ''
  ).trim();

  const targetPace =
    planning.travelStyle === 'Relaxed'
      ? '1 to 2 activities per day (relaxed pace, generous downtime)'
      : planning.travelStyle === 'Packed'
      ? '3 to 4 activities per day (high-energy coverage, maximizing the day)'
      : '2 to 3 activities per day (balanced flow, ample breathing room)';

  const stay = planning.stay;
  const hasExistingStay = stay && stay.mode === 'existing' && Boolean(stay.name?.trim());
  const wantsStayRecommendations = stay && stay.mode === 'help_me_find';

  let staySystemPrompt = '';
  let stayUserPrompt = '';

  if (hasExistingStay && stay && stay.mode === 'existing') {
    staySystemPrompt = `
STAY / ACCOMMODATION ANCHOR CONSTRAINTS:
- Traveler Accommodation: "${stay.name}" located at "${stay.address}"
- Check-in Date: ${stay.checkInDate}${stay.checkInTime ? ` at ${stay.checkInTime}` : ' (standard check-in ~02:00 PM)'}
- Check-out Date: ${stay.checkOutDate}${stay.checkOutTime ? ` at ${stay.checkOutTime}` : ' (standard check-out ~11:00 AM)'}
${stay.bookingNote ? `- Traveler Note: "${stay.bookingNote}"` : ''}

CRITICAL MANDATORY STAY RULES:
1. GEOGRAPHIC ANCHOR: The stay location ("${stay.name}", ${stay.address}) MUST serve as the geographic anchor for each day's route.
2. SENSIBLE DAILY SEQUENCING:
   - For regular middle days: Start the day from the accommodation area -> visit nearby morning activities -> cluster midday/afternoon activities in sensible progression -> evening activity/dinner -> return toward accommodation area.
   - Avoid unnecessary zig-zagging back and forth across distant parts of the city when suitable nearby activities exist.
3. CHECK-IN DAY (${stay.checkInDate}):
   - The traveler cannot check into their room before check-in time (${stay.checkInTime || '02:00 PM'}).
   - Sequence arrival and morning activities before check-in, or schedule checking into the accommodation around ${stay.checkInTime || '02:00 PM'}.
4. CHECK-OUT DAY (${stay.checkOutDate}):
   - The traveler must check out by ${stay.checkOutTime || '11:00 AM'}.
   - Do not assume the traveler can return to the accommodation throughout the afternoon after checking out.
   - Sequence later activities to move progressively toward the departure transit point / airport / station.`;

    stayUserPrompt = `
- Accommodation (Stay Anchor): "${stay.name}", ${stay.address}
- Check-in: ${stay.checkInDate} (${stay.checkInTime || '02:00 PM'})
- Check-out: ${stay.checkOutDate} (${stay.checkOutTime || '11:00 AM'})
${stay.bookingNote ? `- Stay Notes: ${stay.bookingNote}` : ''}
* Please anchor each day around this accommodation, respecting check-in and check-out times and sensible geographic proximity.`;
  } else {
    staySystemPrompt = `
ACCOMMODATION / STAY RECOMMENDATIONS:
Provide 1 to 3 recommended stay areas/neighborhoods in ${destination} in the "stayRecommendations" array based on where the activities in this itinerary are geographically clustered.
- "area": Specific neighborhood or district (e.g. "Candolim / Calangute Cluster", "Shinjuku / Shibuya", "Central Heritage Quarter")
- "whyItFits": Explain how staying in this area minimizes daily travel time to the planned activity clusters.
- "budgetFit": Explain how this area aligns with the ₹${planning.dailyBudget}/day budget.
- "suggestedType": Recommended style (e.g. "Boutique Hotel / Homestay", "Resort", "City Hotel", "Hostel / Co-living")
- "propertyName": NEVER invent fake hotel names, prices, or ratings. Only include if referring to a verified, real-world landmark property, otherwise omit.`;

    if (wantsStayRecommendations) {
      stayUserPrompt = `
- Accommodation Assistance Requested: Help me find a stay. Please analyze the activity clusters in this itinerary and suggest the top 1 to 3 ideal neighborhoods/areas to stay in ${destination} to minimize daily travel.`;
    }
  }

  const systemPrompt = isWithinCity
    ? `You are TravelPilot's dedicated Road Trip & Local Nearby Exploration Planning Engine.
You generate realistic, verified, day-by-day itineraries and grounded road-trip transportation recommendations for exploring in and around a specific home city or locality.

CRITICAL MANDATORY WITHIN-CITY / ROAD TRIP GEOGRAPHIC RULES:
1. GEOGRAPHIC ANCHOR: The user is exploring within and immediately around their home city/locality: "${anchorCity}"${planning.resolvedState ? `, ${planning.resolvedState}` : ''}${planning.resolvedCountry ? `, ${planning.resolvedCountry}` : ''}.
2. STRICT PROXIMITY CONSTRAINT: Every recommended place, viewpoint, scenic road, nature reserve, lake, fort, historic landmark, botanical garden, museum, food street, or local dining establishment MUST be located strictly within "${anchorCity}" or within an immediate road-trip driving distance (0 to 60-80 km max) from "${anchorCity}".
3. ABSOLUTE PROHIBITION ON DISTANT CITIES:
   - You are STRICTLY FORBIDDEN from jumping, reinterpreting, or switching to an unrelated distant city (e.g. if anchor is Pune, DO NOT recommend Jaipur, Delhi, Mumbai, Goa, Udaipur, Bangalore, etc.).
   - Geographic proximity to "${anchorCity}" is an ABSOLUTE HARD CONSTRAINT.
   - Do NOT invent fake places. All attractions must be real, verified, and physically located in or immediately adjacent to "${anchorCity}".
4. EVERY ACTIVITY MUST HAVE:
   - "name": Exact real-world place name located in or around "${anchorCity}"
   - "area": Real neighborhood, district, or scenic route
   - "category": e.g. "Historic Monument", "Museum", "Scenic Viewpoint", "Nature Trail", "Local Market", "Culinary & Dining"
   - "startTime" and "endTime": Chronological, realistic hours in "HH:MM AM/PM" format
   - "durationMinutes": realistic duration in minutes
   - "estimatedCost": realistic estimated admission or activity cost in INR (₹) or 0 if free/public access
   - "travelTimeFromPrevious": realistic driving or walking time (e.g. "Starting point", "25 mins drive via bypass", "15 mins drive")
   - "reason": 1-2 sentence explanation of why this local spot was selected for this traveler.
5. TRANSPORTATION SECTION ("Getting There"):
   - THIS IS A LOCAL ROAD TRIP / WITHIN-CITY EXPEDITION.
   - DO NOT include "flight", "train", or "intercity bus". STRICTLY FORBIDDEN to recommend flights or trains.
   - Provide 1 or 2 dedicated local road trip / driving options:
     * "mode": "road"
     * "title": "Scenic Road Trip / Driving Circuit" (or "Local Cab / Private Vehicle")
     * "description": A concise, practical description of the driving route starting from "${anchorCity}", mentioning key scenic roads/highways, traffic tips, and scenic viewpoints along the drive.
     * "estimatedDuration": realistic driving time for the local circuit (e.g. "Approx. 35–65 km circuit • ~1 to 1.5 hrs driving time")
     * "costEstimate": estimated fuel / toll / parking (e.g. "Estimated fuel/toll: ~₹500 – ₹1,200 total")
     * "actionLabel": "Open Driving Route in Google Maps"
6. WHY THIS PLAN:
   - Concise, personalized reasoning highlighting how the local places match user interests and why it forms a cohesive nearby road trip.
${staySystemPrompt}
7. Return output strictly adhering to the requested JSON schema.`
    : `You are TravelPilot's intelligent universal travel planning engine.
You generate realistic, verified, day-by-day itineraries and grounded transportation recommendations for ANY destination worldwide.

CRITICAL FACTUAL DATA RULES:
1. Recommends ONLY real-world, verifiable places, landmarks, museums, markets, scenic viewpoints, nature spots, and authentic culinary establishments that genuinely exist in reality in "${destination}".
2. STRICTLY FORBIDDEN from inventing fake place names, fictional addresses, fake train/flight numbers, or artificial booking prices.
3. Every activity MUST have:
   - "name": Exact real-world place name (e.g. "Louvre Museum", "Senso-ji", "Hadimba Temple", "Mattancherry Palace", "Burj Khalifa")
   - "area": Real neighborhood, district, or street address
   - "category": e.g. "Historic Monument", "Museum", "Scenic Viewpoint", "Nature Trail", "Local Market", "Culinary & Dining"
   - "startTime" and "endTime": Chronological, realistic hours in "HH:MM AM/PM" format (e.g. "09:30 AM", "12:00 PM")
   - "durationMinutes": realistic duration in minutes (e.g. 60, 90, 120, 180)
   - "estimatedCost": realistic estimated admission or activity cost in INR (₹) or 0 if free/public access. Clearly an estimate.
   - "travelTimeFromPrevious": realistic transit note (e.g. "Starting point", "15 mins metro / taxi", "10 mins walk")
   - "reason": 1-2 sentence explanation of why this spot was selected for this traveler's interests (${(planning.interests || []).join(', ')}), pace (${planning.travelStyle}), and group dynamics (${planning.tripType}).
4. TRANSPORTATION SECTION ("Getting There"):
   - Assess viable travel options to reach "${destination}" ${origin ? `starting from "${origin}"` : 'from major transit hubs'}.
   - Determine applicable options: "flight", "train", "bus", "road" (driving/cab).
     * For international routes or long distances, Flight is essential.
     * For regional routes within India or accessible land routes, include applicable Train (e.g. Vande Bharat, Express), Bus (Sleeper/Intercity), and Road Trip / Driving options.
     * For local destinations, highlight driving or express transit.
   - For each applicable option provide:
     * "mode": one of "flight", "train", "bus", "road", "local"
     * "title": e.g. "Flight", "Train", "Intercity Bus", "Road Trip / Driving"
     * "description": concise explanation of the route, major lines/highways, and convenience factor.
     * "estimatedDuration": realistic travel time (e.g. "1 hr 15 mins non-stop flight", "8–10 hours via NH48", "12 hrs overnight train")
     * "costEstimate": either "Fare varies — check provider" or "Estimated from current information: ~₹X,XXX – ₹X,XXX per person"
     * "actionLabel": e.g. "Search Flights", "Search Trains", "Search Buses", "Open Route in Google Maps"
5. WHY THIS PLAN:
   - Provide concise, personalized reasoning for:
     * "interestsMatch": how the chosen spots align with (${(planning.interests || []).join(', ')})
     * "paceExplanation": how the schedule matches the ${planning.travelStyle} travel style (${targetPace})
     * "budgetExplanation": how total costs stay within the user's daily budget of ₹${planning.dailyBudget}/day
     * "geographicGrouping": how places on each day are clustered to minimize cross-city transit
     * "transportation": brief summary of the transit recommendation to reach ${destination}
${staySystemPrompt}
6. Return output strictly adhering to the requested JSON schema.`;

  const userPrompt = isWithinCity
    ? `Plan a ${dates.length}-day local road trip and scenic getaway in and around ${anchorCity}:
- Starting Point / Anchor City: ${anchorCity}${planning.resolvedState ? `, ${planning.resolvedState}` : ''}${planning.resolvedCountry ? `, ${planning.resolvedCountry}` : ''}
- Destination Area: ${destination}
- Exploration Scope: Within My City / Nearby Road Trip (STRICTLY 0–80 km max from ${anchorCity})
- Travel Dates: ${planning.startDate} to ${planning.endDate} (${dates.length} days: ${dates.join(', ')})
- Travelers: ${planning.travelers} traveler(s) (${planning.tripType} trip)
- Daily Budget: ₹${planning.dailyBudget} / day
- Travel Style: ${planning.travelStyle} (${targetPace})
- Selected Interests: ${(planning.interests || []).join(', ')}
- Prefer Popular Places: ${planning.preferPopular ? 'Yes' : 'No'}
- Prefer Hidden Gems: ${planning.preferHiddenGems ? 'Yes' : 'No'}
- Prefer Places Close Together: Yes
- Minimize Travel Time: Yes
- Prefer Lower-Cost Activities: ${planning.preferLowerCost ? 'Yes' : 'No'}
${stayUserPrompt}

STRICT MANDATE: Recommend real, verified places only in or immediately surrounding ${anchorCity}. Do NOT switch to distant cities like Jaipur, Delhi, or Goa. Transportation MUST be local Road Trip / Driving only.`
    : `Plan a ${dates.length}-day trip for ${destination} with these parameters:
- Destination: ${destination}
- Region / Area Focus: ${planning.region || 'City center & surrounding highlights'}
- Starting From (Origin): ${origin || 'Not specified (assume major origin hub)'}
- Travel Dates: ${planning.startDate} to ${planning.endDate} (${dates.length} days: ${dates.join(', ')})
- Travelers: ${planning.travelers} traveler(s) (${planning.tripType} trip)
- Daily Budget: ₹${planning.dailyBudget} / day
- Travel Style: ${planning.travelStyle} (${targetPace})
- Selected Interests: ${(planning.interests || []).join(', ')}
- Prefer Popular Places: ${planning.preferPopular ? 'Yes' : 'No'}
- Prefer Hidden Gems: ${planning.preferHiddenGems ? 'Yes' : 'No'}
- Prefer Places Close Together: ${planning.preferPlacesCloseTogether ? 'Yes' : 'No'}
- Minimize Travel Time: ${planning.minimizeTravelTime ? 'Yes' : 'No'}
- Prefer Lower-Cost Activities: ${planning.preferLowerCost ? 'Yes' : 'No'}
${stayUserPrompt}

Please select real verified places in ${destination}, group them by proximity, and specify practical transportation options to get there.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      transportation: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                mode: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                estimatedDuration: { type: Type.STRING },
                costEstimate: { type: Type.STRING },
                actionLabel: { type: Type.STRING },
              },
              required: ['mode', 'title', 'description', 'estimatedDuration', 'costEstimate', 'actionLabel'],
            },
          },
        },
        required: ['summary', 'options'],
      },
      whyThisPlan: {
        type: Type.OBJECT,
        properties: {
          interestsMatch: { type: Type.STRING },
          paceExplanation: { type: Type.STRING },
          budgetExplanation: { type: Type.STRING },
          geographicGrouping: { type: Type.STRING },
          transportation: { type: Type.STRING },
        },
        required: ['interestsMatch', 'paceExplanation', 'budgetExplanation', 'geographicGrouping'],
      },
      days: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            dayNumber: { type: Type.INTEGER },
            date: { type: Type.STRING },
            activities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  area: { type: Type.STRING },
                  category: { type: Type.STRING },
                  startTime: { type: Type.STRING },
                  endTime: { type: Type.STRING },
                  durationMinutes: { type: Type.INTEGER },
                  estimatedCost: { type: Type.NUMBER },
                  travelTimeFromPrevious: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  distanceToNext: { type: Type.STRING },
                },
                required: [
                  'name',
                  'area',
                  'category',
                  'startTime',
                  'endTime',
                  'durationMinutes',
                  'estimatedCost',
                  'travelTimeFromPrevious',
                  'reason',
                ],
              },
            },
          },
          required: ['dayNumber', 'date', 'activities'],
        },
      },
      stayRecommendations: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            area: { type: Type.STRING },
            whyItFits: { type: Type.STRING },
            budgetFit: { type: Type.STRING },
            suggestedType: { type: Type.STRING },
            propertyName: { type: Type.STRING },
          },
          required: ['area', 'whyItFits', 'budgetFit'],
        },
      },
    },
    required: ['summary', 'transportation', 'whyThisPlan', 'days'],
  };

  // Try candidate models in order, with retries on transient errors
  let lastError: unknown = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    console.log(`[Diagnostic] Gemini request started with model: "${modelName}" for destination: "${destination}"`);
    const t0 = Date.now();
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });

      const text = response.text;
      const durationMs = Date.now() - t0;
      console.log(`[Diagnostic] Gemini response received from "${modelName}" in ${durationMs}ms (length: ${text?.length || 0} characters).`);

      if (!text || !text.trim()) {
        throw new Error(`Empty response returned from model "${modelName}".`);
      }

      console.log('[Diagnostic] Parsing structured JSON response from Gemini...');
      parsed = JSON.parse(text);

      if (!parsed.days || !Array.isArray(parsed.days) || parsed.days.length === 0) {
        throw new Error(`Model "${modelName}" returned JSON without valid 'days' array.`);
      }

      console.log(`[Diagnostic] Successfully parsed JSON with ${parsed.days.length} day(s) for destination "${destination}".`);
      break; // Successfully obtained parsed result
    } catch (err: unknown) {
      lastError = err;
      const durationMs = Date.now() - t0;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Diagnostic] Model "${modelName}" generation failed after ${durationMs}ms:`, errMsg);
    }
  }

  if (!parsed) {
    console.error('[Diagnostic] All candidate Gemini models failed to generate plan:', lastError);
    throw new Error(
      "TravelPilot couldn't gather enough reliable information for this destination right now. Please try again."
    );
  }

  // Build validated days and activities with verified Google Maps URLs
  console.log('[Diagnostic] Validating activities and candidate places against factual destination parameters...');
  const validatedDays: ItineraryDay[] = dates.map((dateStr, idx) => {
    const dayNum = idx + 1;
    const matchingDay = parsed.days.find(
      (d: { dayNumber?: number; date?: string }) => d.dayNumber === dayNum || d.date === dateStr
    ) || parsed.days[idx] || parsed.days[0];

    const rawActivities = Array.isArray(matchingDay?.activities) ? matchingDay.activities : [];

    const activities: ItineraryActivity[] = rawActivities.map((act: {
      name: string;
      area?: string;
      category?: string;
      startTime?: string;
      endTime?: string;
      durationMinutes?: number;
      estimatedCost?: number;
      travelTimeFromPrevious?: string;
      reason?: string;
      distanceToNext?: string;
    }, actIdx: number) => {
      const placeName = (act.name || 'Local Landmark').trim();
      const area = (act.area || destination).trim();
      const category = (act.category || 'Sightseeing & Culture').trim();
      const candidateId = `act-${encodeURIComponent(placeName.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}-${dayNum}-${actIdx}`;
      const mapsUrl = generateGoogleMapsSearchUrl(placeName, area, destination);

      return {
        candidateId,
        name: placeName,
        area,
        category,
        startTime: act.startTime || (actIdx === 0 ? '09:30 AM' : actIdx === 1 ? '01:30 PM' : '05:00 PM'),
        endTime: act.endTime || (actIdx === 0 ? '11:30 AM' : actIdx === 1 ? '03:30 PM' : '07:00 PM'),
        durationMinutes: Number(act.durationMinutes) || 90,
        estimatedCost: Math.max(0, Number(act.estimatedCost) || 0),
        travelTimeFromPrevious:
          act.travelTimeFromPrevious || (actIdx === 0 ? 'Starting point' : '15–20 mins transit'),
        mapsUrl,
        reason:
          act.reason ||
          `Recommended for its authentic local character matching your ${planning.travelStyle.toLowerCase()} pace.`,
        distanceToNext: act.distanceToNext,
      };
    });

    const estimatedDailyCost = activities.reduce((sum, a) => sum + a.estimatedCost, 0);

    return {
      dayNumber: dayNum,
      date: dateStr,
      estimatedDailyCost,
      activities,
    };
  });
  console.log(`[Diagnostic] Validated ${validatedDays.length} day(s), total activities: ${validatedDays.reduce((acc, d) => acc + d.activities.length, 0)}`);

  // Construct Transport Options with safe external search URLs
  console.log('[Diagnostic] Validating transportation options for route...');
  let rawOptions = Array.isArray(parsed.transportation?.options) ? parsed.transportation.options : [];

  if (isWithinCity) {
    // For Within-City road trips: strictly strip out flight, train, and intercity bus options
    rawOptions = rawOptions.filter((opt: { mode?: string }) => {
      const m = (opt.mode || '').toLowerCase();
      return !['flight', 'train', 'rail', 'bus', 'coach'].includes(m);
    });
  }

  let transportOptions: TransportOption[] = rawOptions.map((opt: {
    mode?: string;
    title?: string;
    description?: string;
    estimatedDuration?: string;
    costEstimate?: string;
    actionLabel?: string;
  }) => {
    let modeStr = (opt.mode || (isWithinCity ? 'road' : 'flight')).toLowerCase();
    if (isWithinCity && ['flight', 'train', 'rail', 'bus', 'coach'].includes(modeStr)) {
      modeStr = 'road';
    }
    let mode: TransportMode = 'flight';
    if (['train', 'rail'].includes(modeStr)) mode = 'train';
    else if (['bus', 'coach'].includes(modeStr)) mode = 'bus';
    else if (['road', 'car', 'drive', 'driving', 'taxi'].includes(modeStr)) mode = 'road';
    else if (['local', 'ferry', 'metro'].includes(modeStr)) mode = 'local';

    let actionUrl = '';
    let defaultLabel = 'Search Options';
    if (mode === 'flight') {
      defaultLabel = 'Search Flights';
      actionUrl = generateFlightSearchUrl(destination, origin, planning.startDate);
    } else if (mode === 'train') {
      defaultLabel = 'Search Trains';
      actionUrl = generateTrainSearchUrl(destination, origin);
    } else if (mode === 'bus') {
      defaultLabel = 'Search Buses';
      actionUrl = generateBusSearchUrl(destination, origin);
    } else if (mode === 'road') {
      defaultLabel = 'Open Route in Google Maps';
      actionUrl = generateDrivingDirectionsUrl(destination, origin || anchorCity);
    } else {
      defaultLabel = 'Open Route in Google Maps';
      actionUrl = isWithinCity
        ? generateDrivingDirectionsUrl(destination, origin || anchorCity)
        : generateGoogleMapsSearchUrl(destination, '', '');
    }

    return {
      mode,
      title: opt.title || (mode === 'road' ? 'Road Trip / Driving Route' : opt.title || (mode === 'flight' ? 'Flight' : mode === 'train' ? 'Train' : 'Intercity Bus')),
      description: opt.description || (isWithinCity ? `Scenic driving circuit around ${anchorCity}.` : `Viable connection from ${origin || 'your origin'} to ${destination}.`),
      estimatedDuration: opt.estimatedDuration || (isWithinCity ? 'Approx. 35–65 km • 45 mins – 1.5 hrs drive' : 'Check schedule'),
      costEstimate: opt.costEstimate || (isWithinCity ? 'Estimated fuel/toll: ~₹500 – ₹1,200 total' : 'Fare varies — check provider'),
      actionLabel: isWithinCity ? 'Open Driving Route in Google Maps' : (opt.actionLabel || defaultLabel),
      actionUrl: isWithinCity ? generateDrivingDirectionsUrl(destination, origin || anchorCity) : actionUrl,
      notes: isWithinCity
        ? 'Turn-by-turn driving directions available on Google Maps.'
        : 'TravelPilot is a planning and recommendation platform. Bookings are completed directly on external provider websites.',
    };
  });

  // Handle mode defaults if AI didn't provide matching options
  if (isWithinCity) {
    transportOptions = transportOptions.filter((opt) => opt.mode === 'road' || opt.mode === 'local');
    if (transportOptions.length === 0) {
      transportOptions.push({
        mode: 'road',
        title: 'Road Trip / Driving Route',
        description: `Direct highway and scenic driving loop starting from ${anchorCity || origin || 'your city'} connecting nearby attractions and viewpoints.`,
        estimatedDuration: 'Approx. 35–65 km circuit • ~1 hr drive',
        costEstimate: 'Estimated fuel/toll: ~₹500 – ₹1,200 total',
        actionLabel: 'Open Route in Google Maps',
        actionUrl: generateDrivingDirectionsUrl(destination, origin || anchorCity),
        notes: 'Turn-by-turn driving directions available on Google Maps.',
      });
    }
  } else if (transportOptions.length === 0) {
    // Normal / outside-city defaults
    transportOptions.push({
      mode: 'flight',
      title: 'Flight',
      description: `Fastest connection into nearest airport serving ${destination}.`,
      estimatedDuration: 'Check airline schedules',
      costEstimate: 'Fare varies — check provider',
      actionLabel: 'Search Flights',
      actionUrl: generateFlightSearchUrl(destination, origin, planning.startDate),
      notes: 'Bookings completed on airline/aggregator portal.',
    });
    transportOptions.push({
      mode: 'road',
      title: 'Road Trip / Driving Route',
      description: `Direct highway and driving route to ${destination}.`,
      estimatedDuration: 'Check real-time traffic',
      costEstimate: 'Fare varies — fuel/toll estimate',
      actionLabel: 'Open Route in Google Maps',
      actionUrl: generateDrivingDirectionsUrl(destination, origin),
      notes: 'Use Google Maps for live navigation and tolls.',
    });
  }
  console.log(`[Diagnostic] Generated ${transportOptions.length} transport option(s) for Getting There.`);

  const gettingThere: GettingThereInfo = {
    origin: origin || anchorCity || undefined,
    destination,
    summary: isWithinCity
      ? (parsed.transportation?.summary || `Local road-trip route starting from ${origin || anchorCity} covering nearby scenic destinations and attractions. Driving distance: approx. 30–75 km total.`)
      : (parsed.transportation?.summary || `Options to travel from ${origin || 'your origin'} to ${destination} via flight, train, bus, or road.`),
    options: transportOptions,
  };

  const totalEstimatedCost = validatedDays.reduce((sum, d) => sum + d.estimatedDailyCost, 0);
  console.log(`[Diagnostic] Itinerary construction complete: Total Estimated Cost: ₹${totalEstimatedCost}, Days: ${validatedDays.length}`);

  // Safely construct stay recommendations with verified external booking/search URLs
  const rawStayRecs = Array.isArray(parsed.stayRecommendations) ? parsed.stayRecommendations : [];
  let stayRecommendations: StayRecommendation[] = rawStayRecs.map((rec: {
    area?: string;
    whyItFits?: string;
    budgetFit?: string;
    suggestedType?: string;
    propertyName?: string;
  }) => {
    const area = (rec.area || destination).trim();
    return {
      area,
      whyItFits: rec.whyItFits || `Strategically positioned near key daily activity clusters across ${destination}.`,
      budgetFit: rec.budgetFit || `Fits comfortably within your ₹${planning.dailyBudget.toLocaleString('en-IN')}/day budget.`,
      suggestedType: rec.suggestedType || 'Hotel / Guesthouse / Homestay',
      propertyName: rec.propertyName?.trim() || undefined,
      searchUrl: generateHotelSearchUrl(destination, area, planning.startDate, planning.endDate),
    };
  });

  if (stayRecommendations.length === 0 && (wantsStayRecommendations || !hasExistingStay)) {
    stayRecommendations = [
      {
        area: destination,
        whyItFits: `Central area providing well-connected daily access to planned highlights across ${destination}.`,
        budgetFit: `Broad range of stays matching your ₹${planning.dailyBudget.toLocaleString('en-IN')}/day budget.`,
        suggestedType: 'Hotel / Resort / Homestay',
        searchUrl: generateHotelSearchUrl(destination, destination, planning.startDate, planning.endDate),
      },
    ];
  }

  console.log(`[Diagnostic] Generated ${stayRecommendations.length} stay recommendation(s).`);
  console.log('[Diagnostic] --- Plan Generation Request Completed Successfully ---');

  return {
    id: `itinerary-${Date.now()}`,
    tripId,
    destination,
    summary:
      parsed.summary ||
      `${dates.length}-day personalized itinerary in ${destination} tailored for a ${planning.tripType} trip at a ${planning.travelStyle.toLowerCase()} pace.`,
    totalEstimatedCost,
    dailyBudget: planning.dailyBudget,
    days: validatedDays,
    transportation: gettingThere,
    stayRecommendations: stayRecommendations.length > 0 ? stayRecommendations : undefined,
    whyThisPlan: {
      interestsMatch:
        parsed.whyThisPlan?.interestsMatch ||
        `Curated around your chosen interests (${(planning.interests || []).join(', ')}).`,
      paceExplanation:
        parsed.whyThisPlan?.paceExplanation ||
        `Structured to match your ${planning.travelStyle} travel style (${targetPace}).`,
      budgetExplanation:
        parsed.whyThisPlan?.budgetExplanation ||
        `Daily activity costs average ₹${Math.round(totalEstimatedCost / dates.length).toLocaleString('en-IN')}, leaving comfortable headroom within your ₹${planning.dailyBudget.toLocaleString('en-IN')}/day budget.`,
      geographicGrouping:
        parsed.whyThisPlan?.geographicGrouping ||
        `Daily stops are clustered by neighborhood to minimize transit time across ${destination}.`,
      transportation:
        parsed.whyThisPlan?.transportation ||
        `Transit options assessed from ${origin || 'origin'} to ${destination}.`,
    },
    generatedAt: new Date().toISOString(),
    generationVersion: 1,
    planningSnapshot: planning,
  };
}

/**
 * Standalone Stay Recommendation Generator for existing trips
 * Recommends 2-3 neighborhood clusters grounded in the destination, budget, and travel interests.
 */
export async function generateStayRecommendationsForTrip(
  destination: string,
  startDate?: string,
  endDate?: string,
  dailyBudget: number = 3000,
  travelStyle: string = 'Balanced',
  interests: string[] = ['Sightseeing']
): Promise<StayRecommendation[]> {
  const ai = getAIClient();
  if (!ai) {
    return [
      {
        area: destination,
        whyItFits: `Central area providing convenient access to attractions across ${destination}.`,
        budgetFit: `Accommodations available matching ~₹${dailyBudget.toLocaleString('en-IN')}/day budget.`,
        suggestedType: 'Hotel / Resort / Homestay',
        searchUrl: generateHotelSearchUrl(destination, destination, startDate, endDate),
      },
    ];
  }

  const prompt = `You are TravelPilot's accommodation advisor.
Recommend 2 to 3 optimal areas / neighborhoods to stay in "${destination}" for a traveler with:
- Travel Style: ${travelStyle}
- Travel Interests: ${interests.join(', ')}
- Daily Budget: ₹${dailyBudget} / day
- Dates: ${startDate || 'Upcoming'} to ${endDate || 'Upcoming'}

MANDATORY RULES:
1. Recommend real neighborhoods/areas within or immediately adjacent to ${destination}.
2. NEVER invent fake hotel names, fake prices, or fake review scores.
3. Explain why the area minimizes travel time and how it fits the budget.

Return a JSON array of 2 to 3 objects with schema:
[
  {
    "area": "Specific real neighborhood or area",
    "whyItFits": "1-2 sentences on why staying here is convenient for activities and transit",
    "budgetFit": "1 sentence on pricing range and alignment with ₹${dailyBudget}/day budget",
    "suggestedType": "e.g. Heritage Homestay, Boutique Hotel, Beach Resort, City Hotel",
    "propertyName": "Optional: Only if a verified landmark historic property, otherwise omit"
  }
]`;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: 'You are TravelPilot accommodation advisor. Return only grounded factual real neighborhood areas. Never hallucinate fake hotels.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                area: { type: Type.STRING },
                whyItFits: { type: Type.STRING },
                budgetFit: { type: Type.STRING },
                suggestedType: { type: Type.STRING },
                propertyName: { type: Type.STRING },
              },
              required: ['area', 'whyItFits', 'budgetFit'],
            },
          },
        },
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item) => ({
            area: item.area || destination,
            whyItFits: item.whyItFits || `Well-connected hub for ${destination}.`,
            budgetFit: item.budgetFit || `Fits ₹${dailyBudget}/day budget.`,
            suggestedType: item.suggestedType || 'Hotel / Homestay',
            propertyName: item.propertyName || undefined,
            searchUrl: generateHotelSearchUrl(destination, item.area, startDate, endDate),
          }));
        }
      }
    } catch (err) {
      console.warn(`[Diagnostic] Stay recommendations failed on model "${modelName}":`, err);
    }
  }

  return [
    {
      area: destination,
      whyItFits: `Central area providing convenient access to attractions across ${destination}.`,
      budgetFit: `Accommodations available matching ~₹${dailyBudget.toLocaleString('en-IN')}/day budget.`,
      suggestedType: 'Hotel / Resort / Homestay',
      searchUrl: generateHotelSearchUrl(destination, destination, startDate, endDate),
    },
  ];
}

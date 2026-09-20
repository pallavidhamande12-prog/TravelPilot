import { GoogleGenAI, Type } from '@google/genai';
import {
  SurpriseDestinationQuery,
  SurpriseDestinationSuggestion,
} from '../src/types/index';

const CANDIDATE_MODELS = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];

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

export function generateGoogleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Reverse geocode latitude/longitude into a verified human-friendly city/locality/state/country.
 * Uses reliable geocoding providers and never returns vague placeholders or invented locations.
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<{ city: string; state?: string; country?: string; formatted: string }> {
  // Strategy 1: BigDataCloud Reverse Geocoding Client API (fast, high accuracy locality resolution)
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(bdcUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const city =
        data.city ||
        data.locality ||
        data.localityInfo?.administrative?.find(
          (a: { adminLevel?: number; name?: string }) => (a.adminLevel || 0) >= 4 && (a.adminLevel || 0) <= 8 && a.name
        )?.name ||
        '';
      const state = data.principalSubdivision || '';
      const country = data.countryName || '';

      if (city && city.trim()) {
        const parts = [city.trim(), state.trim(), country.trim()].filter(Boolean);
        const formatted = parts.join(', ');
        return {
          city: city.trim(),
          state: state.trim() || undefined,
          country: country.trim() || undefined,
          formatted,
        };
      }
    }
  } catch (err) {
    console.warn('[ReverseGeocode] BigDataCloud lookup failed, trying fallback:', err);
  }

  // Strategy 2: Photon Reverse Geocoding (OSM-backed, datacenter-friendly)
  try {
    const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const res = await fetch(photonUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TravelPilot-App/1.0',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const props = data.features?.[0]?.properties || {};
      const city = props.city || props.town || props.district || props.county || props.locality || '';
      const state = props.state || '';
      const country = props.country || '';

      if (city && city.trim()) {
        const parts = [city.trim(), state.trim(), country.trim()].filter(Boolean);
        const formatted = parts.join(', ');
        return {
          city: city.trim(),
          state: state.trim() || undefined,
          country: country.trim() || undefined,
          formatted,
        };
      }
    }
  } catch (err) {
    console.warn('[ReverseGeocode] Photon lookup failed:', err);
  }

  // If no reliable city can be determined, throw so client can prompt user to choose manually
  throw new Error('Unable to determine reliable city name from coordinates.');
}

/**
 * Generate 4 to 5 destination suggestions tailored to user constraints via Gemini.
 * Destination-agnostic worldwide, dynamically generated.
 */
export async function generateSurpriseDestinations(
  query: SurpriseDestinationQuery
): Promise<SurpriseDestinationSuggestion[]> {
  const ai = getAIClient();
  const startLoc = query.startingLocation.trim() || 'Starting City';
  const duration = Math.max(1, query.durationDays || 3);
  const budget = Math.max(500, query.dailyBudget || 4000);
  const interestsList = query.interests && query.interests.length > 0 ? query.interests.join(', ') : 'General Exploration, Food, Sightseeing';

  console.log('[SurpriseEngine] Generating destination suggestions for query:', {
    startLoc,
    duration,
    budget,
    tripType: query.tripType,
    travelStyle: query.travelStyle,
    interests: interestsList,
    placePreference: query.placePreference,
  });

  if (!ai) {
    throw new Error('TravelPilot destination discovery engine is currently unavailable. Please try again.');
  }

  const systemPrompt = `You are TravelPilot's intelligent Destination Discovery Engine.
Your role is to suggest exactly 4 to 5 compelling, distinct travel destinations tailored for travelers setting out from "${startLoc}".
The user wants a surprise destination discovery based on their specific constraints.

CONSTRAINTS:
- Starting Location: "${startLoc}"
- Trip Duration: ${duration} days
- Daily Activity & Living Budget: ~₹${budget.toLocaleString('en-IN')}/day
- Estimated Overall Budget: ~₹${(budget * duration).toLocaleString('en-IN')} total (estimated)
- Travelers: ${query.travelers} (${query.tripType} trip)
- Travel Pace: ${query.travelStyle}
- Traveler Interests: ${interestsList}
- Preference: ${query.placePreference || 'mix'} (Popular vs Hidden Gems)

REQUIREMENTS:
1. Suggest 4 to 5 unique destinations that make geographic and logistical sense for a ${duration}-day trip departing from "${startLoc}".
2. Destination-agnostic worldwide: If the starting location is in India, suggest suitable getaways in India or nearby regions. If starting from any international city, suggest matching regional getaways.
3. Varied styles: Provide good variety among the 4-5 options (e.g. coastal/nature vs heritage/culture vs hill station vs scenic road trip/city break).
4. Each destination must include:
   - "destination": City or region name (e.g., "Goa", "Udaipur", "Hampi", "Gokarna", "Coorg", "Pondicherry", "Jaipur", "Cotswolds", etc.)
   - "region": Specific recommended area/neighborhood (e.g., "South Goa & Agonda", "Old City & Lake Pichola")
   - "reason": A crisp 1-2 sentence explanation of why this destination is an ideal surprise for this traveler's interests (${interestsList}), pace (${query.travelStyle}), and group dynamic (${query.tripType}).
   - "themes": 2-4 short tag strings (e.g. ["Heritage", "Photography", "Lakeside"])
   - "estimatedDailyCost": Realistic daily cost per traveler in INR (must be around ₹${budget}/day, clearly an estimate)
   - "estimatedTotalCost": Realistic overall cost estimate in INR for ${duration} days
   - "travelConsiderations": Practical transit note from "${startLoc}" (e.g. "1 hr flight or 8-9 hr drive", "Overnight express train", "3 hr scenic highway drive", "Short non-stop flight")
5. STRICTLY FORBIDDEN:
   - Do NOT invent real-time ticket availability, seat availability, hotel vacancies, or booking confirmation numbers.
   - All costs are clearly labeled estimates.
   - Never output markdown outside the JSON response.`;

  const jsonSchema = {
    type: Type.OBJECT,
    properties: {
      suggestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            destination: { type: Type.STRING },
            region: { type: Type.STRING },
            reason: { type: Type.STRING },
            themes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            estimatedDailyCost: { type: Type.INTEGER },
            estimatedTotalCost: { type: Type.INTEGER },
            travelConsiderations: { type: Type.STRING },
          },
          required: [
            'destination',
            'reason',
            'themes',
            'estimatedDailyCost',
            'estimatedTotalCost',
            'travelConsiderations',
          ],
        },
      },
    },
    required: ['suggestions'],
  };

  let rawSuggestions: Array<{
    destination: string;
    region?: string;
    reason: string;
    themes: string[];
    estimatedDailyCost: number;
    estimatedTotalCost: number;
    travelConsiderations: string;
  }> = [];

  let lastError: unknown = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      console.log(`[SurpriseEngine] Calling model ${modelName}...`);
      const t0 = Date.now();
      const res = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: jsonSchema,
        },
      });

      const text = res.text;
      console.log(`[SurpriseEngine] Model ${modelName} responded in ${Date.now() - t0}ms`);
      if (text && text.trim()) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed.suggestions) && parsed.suggestions.length >= 3) {
          rawSuggestions = parsed.suggestions;
          break;
        }
      }
    } catch (err) {
      lastError = err;
      console.warn(`[SurpriseEngine] Model ${modelName} suggestion call failed:`, err);
    }
  }

  if (rawSuggestions.length === 0) {
    console.error('[SurpriseEngine] All AI models failed for suggestions:', lastError);
    throw new Error(
      "TravelPilot couldn't gather destination recommendations right now. Please try adjusting your starting location or budget."
    );
  }

  // Format and assign IDs & Google Maps search URLs
  return rawSuggestions.slice(0, 5).map((item, index) => {
    const destName = item.destination.trim();
    const regionName = (item.region || '').trim();
    const queryTerm = regionName ? `${destName}, ${regionName}` : destName;

    return {
      id: `sug-${index}-${destName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      destination: destName,
      region: regionName || undefined,
      reason: item.reason,
      themes: Array.isArray(item.themes) && item.themes.length > 0 ? item.themes : ['Discovery', 'Getaway'],
      estimatedDailyCost: Math.max(500, Number(item.estimatedDailyCost) || budget),
      estimatedTotalCost: Math.max(1000, Number(item.estimatedTotalCost) || budget * duration),
      travelConsiderations: item.travelConsiderations || `Convenient transit access from ${startLoc}.`,
      mapsUrl: generateGoogleMapsSearchUrl(queryTerm),
    };
  });
}

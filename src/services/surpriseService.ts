import {
  SurpriseDestinationQuery,
  SurpriseDestinationSuggestion,
  ResolvedLocation,
} from '../types';

export async function fetchSurpriseDestinations(
  query: SurpriseDestinationQuery
): Promise<SurpriseDestinationSuggestion[]> {
  const response = await fetch('/api/surprise/destinations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(query),
  });

  const data = await response.json();

  if (!response.ok || data.status === 'error') {
    throw new Error(
      data.message ||
        "TravelPilot couldn't discover destinations right now. Please check your starting location and try again."
    );
  }

  return data.suggestions || [];
}

export async function reverseGeocodeLocation(
  lat: number,
  lng: number
): Promise<ResolvedLocation> {
  // Try server-side endpoint first
  try {
    const response = await fetch(`/api/location/reverse-geocode?lat=${lat}&lng=${lng}`);
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'ready' && data.location && data.location.city) {
        return {
          city: data.location.city,
          state: data.location.state,
          country: data.location.country,
          formatted: data.location.formatted || data.location.city,
          coordinates: { latitude: lat, longitude: lng },
        };
      }
    }
  } catch (err) {
    console.warn('Server reverse geocode failed, attempting direct browser lookup:', err);
  }

  // Direct client-side fallback via BigDataCloud client API
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(bdcUrl);
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
        return {
          city: city.trim(),
          state: state.trim() || undefined,
          country: country.trim() || undefined,
          formatted: parts.join(', '),
          coordinates: { latitude: lat, longitude: lng },
        };
      }
    }
  } catch (fallbackErr) {
    console.warn('Direct browser reverse geocode failed:', fallbackErr);
  }

  throw new Error('Unable to determine reliable city name from coordinates.');
}

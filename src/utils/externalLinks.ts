/**
 * External provider redirection utilities
 *
 * TravelPilot is NOT a booking platform.
 * All booking and navigation actions must redirect externally in a new browser tab.
 */

export function openExternalUrl(url: string): void {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function openGoogleMapsSearch(query: string): void {
  const encoded = encodeURIComponent(query);
  openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
}

export function openGoogleMapsDirections(destination: string, origin?: string): void {
  const destEncoded = encodeURIComponent(destination);
  const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : '';
  openExternalUrl(`https://www.google.com/maps/dir/?api=1&destination=${destEncoded}${originParam}`);
}

export function getProviderUrl(provider: 'irctc' | 'redbus' | 'uber' | 'ola' | 'rapido' | 'flights' | 'hotels'): string {
  switch (provider) {
    case 'irctc':
      return 'https://www.irctc.co.in/';
    case 'redbus':
      return 'https://www.redbus.in/';
    case 'uber':
      return 'https://m.uber.com/';
    case 'ola':
      return 'https://book.olacabs.com/';
    case 'rapido':
      return 'https://rapido.bike/';
    case 'flights':
      return 'https://www.google.com/travel/flights';
    case 'hotels':
      return 'https://www.google.com/travel/hotels';
    default:
      return 'https://www.google.com';
  }
}

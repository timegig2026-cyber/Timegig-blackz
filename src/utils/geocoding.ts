// Resilient Geocoding Service with Local South African Catalog and Multi-tier Fallbacks

export interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
}

// Comprehensive local catalog of South African cities, towns, and metro areas
// This ensures instant, zero-error geocoding even when offline, sandboxed, or when external APIs rate-limit
export const SOUTH_AFRICAN_LOCATIONS: Array<{ name: string; province: string; lat: number; lng: number }> = [
  { name: 'Johannesburg', province: 'Gauteng', lat: -26.2041, lng: 28.0473 },
  { name: 'Sandton', province: 'Gauteng', lat: -26.1076, lng: 28.0567 },
  { name: 'Rosebank', province: 'Gauteng', lat: -26.1467, lng: 28.0436 },
  { name: 'Soweto', province: 'Gauteng', lat: -26.2678, lng: 27.8585 },
  { name: 'Pretoria', province: 'Gauteng', lat: -25.7479, lng: 28.2293 },
  { name: 'Centurion', province: 'Gauteng', lat: -25.8603, lng: 28.1895 },
  { name: 'Midrand', province: 'Gauteng', lat: -25.9984, lng: 28.1263 },
  { name: 'Randburg', province: 'Gauteng', lat: -26.0936, lng: 27.9947 },
  { name: 'Roodepoort', province: 'Gauteng', lat: -26.1625, lng: 27.8725 },
  { name: 'Boksburg', province: 'Gauteng', lat: -26.2127, lng: 28.2616 },
  { name: 'Benoni', province: 'Gauteng', lat: -26.1883, lng: 28.3206 },
  { name: 'Germiston', province: 'Gauteng', lat: -26.2254, lng: 28.1691 },
  { name: 'Kempton Park', province: 'Gauteng', lat: -26.1076, lng: 28.2313 },
  { name: 'Tembisa', province: 'Gauteng', lat: -25.9964, lng: 28.2269 },
  { name: 'Alexandra', province: 'Gauteng', lat: -26.1044, lng: 28.0931 },
  { name: 'Katlehong', province: 'Gauteng', lat: -26.3314, lng: 28.1578 },
  { name: 'Vosloorus', province: 'Gauteng', lat: -26.3581, lng: 28.2044 },
  { name: 'Cape Town', province: 'Western Cape', lat: -33.9249, lng: 18.4241 },
  { name: 'Stellenbosch', province: 'Western Cape', lat: -33.9321, lng: 18.8602 },
  { name: 'Bellville', province: 'Western Cape', lat: -33.8943, lng: 18.6294 },
  { name: 'Paarl', province: 'Western Cape', lat: -33.7342, lng: 18.9621 },
  { name: 'George', province: 'Western Cape', lat: -33.9630, lng: 22.4617 },
  { name: 'Knysna', province: 'Western Cape', lat: -34.0363, lng: 23.0471 },
  { name: 'Plettenberg Bay', province: 'Western Cape', lat: -34.0527, lng: 23.3716 },
  { name: 'Mossel Bay', province: 'Western Cape', lat: -34.1831, lng: 22.1460 },
  { name: 'Hermanus', province: 'Western Cape', lat: -34.4167, lng: 19.2333 },
  { name: 'Somerset West', province: 'Western Cape', lat: -34.0811, lng: 18.8465 },
  { name: 'Durban', province: 'KwaZulu-Natal', lat: -29.8587, lng: 31.0218 },
  { name: 'Umhlanga', province: 'KwaZulu-Natal', lat: -29.7274, lng: 31.0847 },
  { name: 'Ballito', province: 'KwaZulu-Natal', lat: -29.5390, lng: 31.2144 },
  { name: 'Pinetown', province: 'KwaZulu-Natal', lat: -29.8164, lng: 30.8576 },
  { name: 'Pietermaritzburg', province: 'KwaZulu-Natal', lat: -29.6006, lng: 30.3794 },
  { name: 'Richards Bay', province: 'KwaZulu-Natal', lat: -28.7807, lng: 32.0383 },
  { name: 'Newcastle', province: 'KwaZulu-Natal', lat: -27.7579, lng: 29.9318 },
  { name: 'Port Elizabeth', province: 'Eastern Cape', lat: -33.9608, lng: 25.6022 },
  { name: 'Gqeberha', province: 'Eastern Cape', lat: -33.9608, lng: 25.6022 },
  { name: 'East London', province: 'Eastern Cape', lat: -33.0153, lng: 27.8999 },
  { name: 'Mthatha', province: 'Eastern Cape', lat: -31.5889, lng: 28.7844 },
  { name: 'Makhanda', province: 'Eastern Cape', lat: -33.3106, lng: 26.5256 },
  { name: 'Bloemfontein', province: 'Free State', lat: -29.1183, lng: 26.2249 },
  { name: 'Welkom', province: 'Free State', lat: -27.9774, lng: 26.7351 },
  { name: 'Sasolburg', province: 'Free State', lat: -26.8121, lng: 27.8188 },
  { name: 'Bethlehem', province: 'Free State', lat: -28.2308, lng: 28.3089 },
  { name: 'Polokwane', province: 'Limpopo', lat: -23.9045, lng: 29.4689 },
  { name: 'Tzaneen', province: 'Limpopo', lat: -23.8332, lng: 30.1635 },
  { name: 'Thohoyandou', province: 'Limpopo', lat: -22.9456, lng: 30.4849 },
  { name: 'Mokopane', province: 'Limpopo', lat: -24.1944, lng: 29.0097 },
  { name: 'Nelspruit', province: 'Mpumalanga', lat: -25.4753, lng: 30.9694 },
  { name: 'Mbombela', province: 'Mpumalanga', lat: -25.4753, lng: 30.9694 },
  { name: 'Witbank', province: 'Mpumalanga', lat: -25.8728, lng: 29.2332 },
  { name: 'eMalahleni', province: 'Mpumalanga', lat: -25.8728, lng: 29.2332 },
  { name: 'Middelburg', province: 'Mpumalanga', lat: -25.7751, lng: 29.4648 },
  { name: 'Secunda', province: 'Mpumalanga', lat: -26.5503, lng: 29.1764 },
  { name: 'Rustenburg', province: 'North West', lat: -25.6676, lng: 27.2421 },
  { name: 'Potchefstroom', province: 'North West', lat: -26.7145, lng: 27.0970 },
  { name: 'Klerksdorp', province: 'North West', lat: -26.8521, lng: 26.6667 },
  { name: 'Mahikeng', province: 'North West', lat: -25.8652, lng: 25.6442 },
  { name: 'Kimberley', province: 'Northern Cape', lat: -28.7282, lng: 24.7499 },
  { name: 'Upington', province: 'Northern Cape', lat: -28.4478, lng: 21.2561 },
  { name: 'Springbok', province: 'Northern Cape', lat: -29.6643, lng: 17.8865 },
];

/**
 * Search local catalog for matches.
 */
export function searchLocalCatalog(query: string, limit = 5): GeocodeResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches = SOUTH_AFRICAN_LOCATIONS.filter(
    (loc) => loc.name.toLowerCase().includes(q) || loc.province.toLowerCase().includes(q)
  ).slice(0, limit);

  return matches.map((m) => ({
    display_name: `${m.name}, ${m.province}, South Africa`,
    lat: m.lat.toString(),
    lon: m.lng.toString(),
  }));
}

/**
 * Reverse geocode locally by proximity.
 */
export function reverseGeocodeLocal(lat: number, lng: number): string | null {
  let closest: (typeof SOUTH_AFRICAN_LOCATIONS)[0] | null = null;
  let minDistance = Infinity;

  for (const loc of SOUTH_AFRICAN_LOCATIONS) {
    const dLat = loc.lat - lat;
    const dLng = loc.lng - lng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng); // Approximate degree distance
    if (dist < minDistance) {
      minDistance = dist;
      closest = loc;
    }
  }

  // Within ~0.25 degrees (~25km)
  if (closest && minDistance < 0.25) {
    return `${closest.name}, ${closest.province}`;
  }
  return null;
}

/**
 * Query Photon (Komoot) Geocoding API with open CORS.
 */
async function searchPhoton(query: string, limit = 5): Promise<GeocodeResult[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];

    const data = await res.json();
    if (!data || !Array.isArray(data.features)) return [];

    return data.features.map((f: any) => {
      const p = f.properties || {};
      const coords = f.geometry?.coordinates || [0, 0];
      const parts = [p.name, p.city || p.county, p.state, p.country].filter(Boolean);
      return {
        display_name: parts.join(', ') || query,
        lon: coords[0]?.toString() || '0',
        lat: coords[1]?.toString() || '0',
      };
    });
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

/**
 * Query Open-Meteo Geocoding API with open CORS.
 */
async function searchOpenMeteo(query: string, limit = 5): Promise<GeocodeResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=${limit}&language=en&format=json`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];

    const data = await res.json();
    if (!data || !Array.isArray(data.results)) return [];

    return data.results.map((r: any) => {
      const parts = [r.name, r.admin1, r.country].filter(Boolean);
      return {
        display_name: parts.join(', ') || query,
        lat: r.latitude?.toString() || '0',
        lon: r.longitude?.toString() || '0',
      };
    });
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

/**
 * Resilient multi-provider location search.
 * Always resolves gracefully without uncaught exceptions or console errors.
 */
export async function searchLocations(
  query: string,
  limit = 5,
  userPosition?: { lat: number; lng: number } | null
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const lower = trimmed.toLowerCase();
  const isNearby = lower.includes('near') || lower.includes('around') || lower.includes('close');

  if (isNearby && userPosition) {
    const nearbyResult: GeocodeResult = {
      display_name: '📍 Nearby Places (Your Current Location)',
      lat: userPosition.lat.toString(),
      lon: userPosition.lng.toString(),
    };
    const otherMatches = searchLocalCatalog('', limit - 1);
    return [nearbyResult, ...otherMatches];
  }

  // Check local database first for instant suggestions
  const localMatches = searchLocalCatalog(trimmed, limit);

  try {
    // Tier 1: Photon
    const photonResults = await searchPhoton(trimmed, limit);
    if (photonResults.length > 0) {
      // Merge with local matches if available without duplicates
      const seen = new Set<string>();
      const combined: GeocodeResult[] = [];
      for (const item of [...photonResults, ...localMatches]) {
        const key = `${parseFloat(item.lat).toFixed(2)},${parseFloat(item.lon).toFixed(2)}`;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(item);
        }
      }
      return combined.slice(0, limit);
    }

    // Tier 2: Open-Meteo
    const openMeteoResults = await searchOpenMeteo(trimmed, limit);
    if (openMeteoResults.length > 0) {
      return openMeteoResults;
    }
  } catch {
    // Non-blocking fallback
  }

  // Tier 3: Return local catalog matches if network calls fail
  return localMatches;
}

/**
 * Resilient reverse geocoding to resolve address/name from coordinates.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // 1. Try local catalog first (super fast and offline resilient)
  const localName = reverseGeocodeLocal(lat, lng);
  if (localName) return localName;

  // 2. Try Photon reverse geocoding
  try {
    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.features) && data.features.length > 0) {
        const p = data.features[0].properties || {};
        const name = p.name || p.city || p.locality || p.district || p.state;
        if (name) {
          const state = p.state ? `, ${p.state}` : '';
          return `${name}${state}`;
        }
      }
    }
  } catch {
    // Non-blocking fallback
  }

  // 3. Fallback to clean coordinate representation
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { generateItinerary, generateStayRecommendationsForTrip } from './server/itineraryEngine';
import { replanItinerary } from './server/replanEngine';
import {
  generateSurpriseDestinations,
  reverseGeocodeCoordinates,
} from './server/surpriseEngine';
import { SurpriseDestinationQuery } from './src/types/index';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API routes FIRST
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      app: 'TravelPilot',
      version: '1.0.0-universal',
      description: 'Universal intelligent trip planning and disruption management foundation with Gemini AI itinerary engine',
    });
  });

  // Central itinerary generation endpoint (supports ANY destination worldwide)
  app.post('/api/plan/generate', async (req, res) => {
    try {
      const { tripId = 'trip-draft', planning } = req.body;
      console.log(
        `[Server /api/plan/generate] Received generation request for tripId="${tripId}", destination="${planning?.destination}", origin="${planning?.origin || 'none'}"`
      );

      if (!planning) {
        console.warn('[Server /api/plan/generate] Validation error: Missing planning parameters.');
        return res.status(400).json({
          status: 'error',
          message: 'Planning parameters are required to generate an itinerary.',
        });
      }

      if (!planning.destination || !planning.destination.trim()) {
        console.warn('[Server /api/plan/generate] Validation error: Missing destination or city.');
        return res.status(400).json({
          status: 'error',
          message: 'Destination or city is required to generate an itinerary.',
        });
      }

      const itinerary = await generateItinerary(planning, tripId);
      console.log(
        `[Server /api/plan/generate] Successfully generated plan "${itinerary.id}" for destination "${itinerary.destination}" (${itinerary.days.length} days).`
      );

      return res.json({
        status: 'ready',
        planId: itinerary.id,
        itinerary,
      });
    } catch (err: unknown) {
      console.error('[Server /api/plan/generate] Error generating itinerary:', err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "TravelPilot couldn't gather enough reliable information for this destination right now. Please try again.";
      return res.status(500).json({
        status: 'error',
        message: errorMessage,
      });
    }
  });

  // Adaptive Disruption Analysis & Constrained Replanning endpoint
  app.post('/api/plan/replan', async (req, res) => {
    try {
      const { itinerary, disruption, userLocation } = req.body;
      console.log(
        `[Server /api/plan/replan] Received disruption for activity "${disruption?.activityName}" on Day ${disruption?.dayNumber}: "${disruption?.description}"`
      );

      if (!itinerary || !itinerary.days) {
        return res.status(400).json({
          status: 'error',
          message: 'Active itinerary is required for replanning.',
        });
      }

      if (!disruption || !disruption.activityName) {
        return res.status(400).json({
          status: 'error',
          message: 'Disruption details and affected activity are required.',
        });
      }

      const replanResult = await replanItinerary({
        itinerary,
        disruption,
        userLocation,
      });

      return res.json(replanResult);
    } catch (err: unknown) {
      console.error('[Server /api/plan/replan] Error during constrained replan:', err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to analyze disruption and generate constrained replacements.';
      return res.status(500).json({
        status: 'error',
        message: errorMessage,
      });
    }
  });

  // Contextual Stay / Accommodation Recommendation Endpoint
  app.post('/api/stay/recommend', async (req, res) => {
    try {
      const { destination, startDate, endDate, dailyBudget, travelStyle, interests } = req.body;
      if (!destination || !destination.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Destination is required for stay recommendations.',
        });
      }

      console.log(`[Server /api/stay/recommend] Generating stay recommendations for "${destination}"`);
      const recommendations = await generateStayRecommendationsForTrip(
        destination.trim(),
        startDate,
        endDate,
        Number(dailyBudget) || 3000,
        travelStyle || 'Balanced',
        Array.isArray(interests) ? interests : ['Sightseeing']
      );

      return res.json({
        status: 'ready',
        recommendations,
      });
    } catch (err: unknown) {
      console.error('[Server /api/stay/recommend] Error generating stay recommendations:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Could not fetch stay recommendations at this time.',
      });
    }
  });

  // Reverse geocode latitude/longitude into human-readable city/region
  app.get('/api/location/reverse-geocode', async (req, res) => {
    try {
      const lat = parseFloat(String(req.query.lat));
      const lng = parseFloat(String(req.query.lng));

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          status: 'error',
          message: 'Valid latitude and longitude query parameters are required.',
        });
      }

      const location = await reverseGeocodeCoordinates(lat, lng);
      return res.json({
        status: 'ready',
        location,
      });
    } catch (err: unknown) {
      console.warn('[Server /api/location/reverse-geocode] Lookup error:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Could not resolve location coordinates.',
      });
    }
  });

  // Dynamic surprise destination discovery endpoint
  app.post('/api/surprise/destinations', async (req, res) => {
    try {
      const query = req.body as SurpriseDestinationQuery;
      console.log(
        `[Server /api/surprise/destinations] Query from startingLocation="${query?.startingLocation}", duration=${query?.durationDays}d, budget=₹${query?.dailyBudget}`
      );

      if (!query || !query.startingLocation || !query.startingLocation.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Starting location is required to discover destination options.',
        });
      }

      const suggestions = await generateSurpriseDestinations(query);
      console.log(
        `[Server /api/surprise/destinations] Generated ${suggestions.length} suggestions: ${suggestions.map((s) => s.destination).join(', ')}`
      );

      return res.json({
        status: 'ready',
        suggestions,
      });
    } catch (err: unknown) {
      console.error('[Server /api/surprise/destinations] Error discovering destinations:', err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "TravelPilot couldn't discover destinations right now. Please try again.";
      return res.status(500).json({
        status: 'error',
        message: errorMessage,
      });
    }
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TravelPilot server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

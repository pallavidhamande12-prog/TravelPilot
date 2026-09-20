/**
 * TravelPilot Central Planning Engine
 * 
 * CORE ARCHITECTURE RULE:
 * TravelPilot uses ONE central planning engine: generatePlan(params).
 * This single planning engine is responsible for:
 * 1. Creating the initial itinerary.
 * 2. Replacing a removed itinerary item.
 * 3. Re-planning after a simulated or real disruption.
 *
 * DO NOT create separate itinerary generators (e.g. generateInitialPlan,
 * generateReplacementPlan, generateDisruptionPlan).
 */

import { GeneratePlanParams, PlanResult, TripPlanningParameters } from '../types';

/**
 * Single entry point for all itinerary generation and modification.
 * Universal destination support: passes planning parameters directly to server-side Gemini engine.
 * Handled modes:
 * - 'initial': Creates full day-by-day itinerary
 * - 'replace_item': Replaces specific activity
 * - 'replan_disruption': Re-plans itinerary after disruption
 */
export async function generatePlan(params: GeneratePlanParams): Promise<PlanResult> {
  const planning: TripPlanningParameters | undefined = params.planning;

  if (!planning) {
    return {
      status: 'error',
      message: 'Planning parameters (destination, dates, budget, interests) are required to generate an itinerary.',
    };
  }

  const destination = planning.destination?.trim() || '';
  if (!destination) {
    return {
      status: 'error',
      message: 'Destination or city cannot be empty.',
    };
  }

  try {
    const response = await fetch('/api/plan/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: params.mode || 'initial',
        tripId: params.tripId || 'trip-draft',
        planning,
        targetItemId: params.targetItemId,
        disruptionContext: params.disruptionContext,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.status === 'error') {
      return {
        status: 'error',
        message: data.message || 'Server encountered an error generating the itinerary.',
      };
    }

    return {
      status: 'ready',
      planId: data.planId,
      itinerary: data.itinerary,
      message: data.itinerary?.summary || 'Itinerary generated successfully.',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Network failure while requesting itinerary generation.';
    return {
      status: 'error',
      message: errorMsg,
    };
  }
}

export {
  analyzeAndReplanDisruption as replanItinerary,
  applyReplacementToItinerary,
  removeActivityFromItinerary,
  updateActivityStatus,
} from './replanService';


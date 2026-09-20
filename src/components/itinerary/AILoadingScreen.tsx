import React, { useState, useEffect } from 'react';
import { Sparkles, Compass, CheckCircle2 } from 'lucide-react';

interface AILoadingScreenProps {
  destination: string;
  travelStyle?: string;
  onCancel?: () => void;
}

const PROGRESS_STEPS = [
  'Understanding your preferences',
  'Finding suitable activities',
  'Optimizing your days',
  'Checking your budget',
  'Building your itinerary',
];

export const AILoadingScreen: React.FC<AILoadingScreenProps> = ({
  destination,
  travelStyle = 'Balanced',
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => (prev < PROGRESS_STEPS.length - 1 ? prev + 1 : prev));
    }, 1800);

    return () => clearInterval(timer);
  }, []);

  return (
    <div
      id="ai-planning-loading-screen"
      className="max-w-xl mx-auto py-12 px-6 text-center space-y-8 animate-fadeIn"
    >
      {/* Animated Icon Container */}
      <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
        {/* Subtle breathing ripple */}
        <div className="absolute inset-0 rounded-3xl bg-emerald-100/60 animate-ping opacity-30" />
        <div className="absolute inset-1 rounded-2xl bg-emerald-50 border border-emerald-200" />
        <div className="relative w-16 h-16 rounded-2xl bg-stone-900 text-white flex items-center justify-center shadow-lg">
          <Sparkles className="w-8 h-8 text-amber-300 animate-pulse" />
        </div>
      </div>

      {/* Main Title & Subtitle */}
      <div className="space-y-2">
        <h2 id="loading-main-heading" className="text-2xl sm:text-3xl font-bold text-stone-900">
          TravelPilot AI is planning your trip...
        </h2>
        <p className="text-sm text-stone-600 max-w-md mx-auto">
          Crafting a personalized, day-by-day {travelStyle.toLowerCase()} schedule tailored for{' '}
          <span className="font-semibold text-stone-900">{destination}</span>.
        </p>
      </div>

      {/* Progressive Step Tracker */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-sm max-w-md mx-auto text-left space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold text-stone-500 pb-2 border-b border-stone-100 uppercase tracking-wider">
          <span>AI Engine Progress</span>
          <span className="text-emerald-700 font-bold">
            Step {currentStepIndex + 1} of {PROGRESS_STEPS.length}
          </span>
        </div>

        <div className="space-y-3">
          {PROGRESS_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div
                key={step}
                className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                  isCurrent
                    ? 'text-stone-900 font-bold scale-[1.01]'
                    : isCompleted
                    ? 'text-stone-500 font-medium'
                    : 'text-stone-300'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors shrink-0 ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-amber-100 text-amber-800 border-2 border-amber-500 animate-pulse'
                      : 'bg-stone-100 text-stone-400'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <span>{step}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-stone-400 flex items-center justify-center gap-2">
        <Compass className="w-4 h-4 animate-spin" />
        <span>Synthesizing candidate attractions, transit durations, and budget estimates...</span>
      </div>
    </div>
  );
};

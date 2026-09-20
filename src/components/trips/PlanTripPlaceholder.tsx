import React from 'react';
import { ArrowLeft, Compass, Plus, Sparkles } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface PlanTripPlaceholderProps {
  onBack: () => void;
  onCreateDirect: () => void;
}

export const PlanTripPlaceholder: React.FC<PlanTripPlaceholderProps> = ({
  onBack,
  onCreateDirect,
}) => {
  return (
    <div id="plan-trip-placeholder-page" className="max-w-2xl mx-auto space-y-6 py-6 animate-in fade-in duration-150">
      <Button
        variant="outline"
        size="sm"
        onClick={onBack}
        icon={<ArrowLeft className="w-3.5 h-3.5" />}
      >
        Back to My Trips
      </Button>

      <Card variant="surface" className="p-8 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-[#EBF3F5] text-[#0F4C5C] flex items-center justify-center mx-auto shadow-xs">
          <Compass className="w-7 h-7" />
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FAF0EC] text-[#C85A32]">
            <Sparkles className="w-3 h-3" />
            <span>Part 3 Placeholder Flow</span>
          </div>
          <h1 className="text-2xl font-semibold text-[#1C1917]">
            Plan a Trip
          </h1>
          <p className="text-sm text-[#57534E] leading-relaxed">
            The full interactive planning questionnaire and itinerary generator will arrive in subsequent parts.
            You can create a trip right now using the trip parameters form.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            Back to My Trips
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onCreateDirect}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Create Trip with Form
          </Button>
        </div>
      </Card>
    </div>
  );
};

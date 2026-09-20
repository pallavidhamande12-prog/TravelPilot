import React from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface SurpriseMePlaceholderProps {
  onBack: () => void;
  onPlanTrip: () => void;
}

export const SurpriseMePlaceholder: React.FC<SurpriseMePlaceholderProps> = ({
  onBack,
  onPlanTrip,
}) => {
  return (
    <div id="surprise-me-placeholder-page" className="max-w-2xl mx-auto space-y-6 py-6 animate-in fade-in duration-150">
      <Button
        variant="outline"
        size="sm"
        onClick={onBack}
        icon={<ArrowLeft className="w-3.5 h-3.5" />}
      >
        Back to My Trips
      </Button>

      <Card variant="surface" className="p-8 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-[#FAF0EC] text-[#C85A32] flex items-center justify-center mx-auto shadow-xs">
          <Sparkles className="w-7 h-7" />
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EBF3F5] text-[#0F4C5C]">
            <span>Coming in Later Parts</span>
          </div>
          <h1 className="text-2xl font-semibold text-[#1C1917]">
            Surprise Me
          </h1>
          <p className="text-sm text-[#57534E] leading-relaxed">
            The Surprise Me AI discovery engine will intelligently curate mystery destinations and spontaneous itineraries.
            In Part 3, trip management foundations are established.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            Back to My Trips
          </Button>
          <Button variant="primary" size="sm" onClick={onPlanTrip}>
            Create a Trip Instead
          </Button>
        </div>
      </Card>
    </div>
  );
};

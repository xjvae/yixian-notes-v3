import { Check } from 'lucide-react';
import { STEPS } from './data/steps';

interface StepIndicatorProps {
  currentStep: number;
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div
            className={`size-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
              i <= currentStep
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {i < currentStep ? (
              <Check className="size-3.5" />
            ) : (
              <span>{i + 1}</span>
            )}
          </div>
          <span
            className={`text-xs hidden sm:inline ${
              i === currentStep
                ? 'text-foreground font-medium'
                : 'text-muted-foreground'
            }`}
          >
            {s.title}
          </span>
          {i < STEPS.length - 1 && (
            <div
              className={`w-6 sm:w-10 h-0.5 rounded-full ${
                i < currentStep ? 'bg-primary' : 'bg-border'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

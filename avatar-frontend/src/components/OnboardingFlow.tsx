'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import type { UserData } from '@/context/AppContext';

const steps = [
  { question: "What's your name?", field: 'name' as keyof UserData, type: 'text', placeholder: 'Enter your name' },
  { question: 'How old are you?', field: 'age' as keyof UserData, type: 'number', placeholder: 'Enter your age' },
  { question: 'Your pronouns?', field: 'pronouns' as keyof UserData, type: 'select', options: ['He/Him', 'She/Her', 'They/Them', 'Prefer not to say'] },
  { question: 'Where are you from?', field: 'location' as keyof UserData, type: 'text', placeholder: 'City, Country' },
];

export default function OnboardingFlow() {
  const router = useRouter();
  const { handleOnboardingComplete, isOnboarded } = useAppContext();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<Partial<UserData>>({ name: '', age: '', pronouns: '', location: '' });

  React.useEffect(() => {
    if (isOnboarded) router.replace('/vibe-check');
  }, [isOnboarded, router]);

  const currentStep = steps[step];
  const fieldValue = formData[currentStep.field] as string;

  const handleNext = () => {
    if (!fieldValue) { alert('Please fill in this field'); return; }
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleOnboardingComplete({ name: formData.name || 'Friend', id: crypto.randomUUID?.() || 'user', ...formData });
      router.push('/vibe-check');
    }
  };

  const handleChange = (field: keyof UserData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <div className="progress-dots">
          {steps.map((_, idx) => (
            <div key={idx} className={`dot ${idx <= step ? 'active' : ''}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="onboarding-step"
          >
            <h2>{currentStep.question}</h2>

            {currentStep.type === 'text' || currentStep.type === 'number' ? (
              <input
                type={currentStep.type}
                value={fieldValue}
                onChange={(e) => handleChange(currentStep.field, e.target.value)}
                placeholder={currentStep.placeholder}
                className="onboarding-input"
                autoFocus
              />
            ) : currentStep.type === 'select' ? (
              <div className="onboarding-options">
                {currentStep.options!.map((option) => (
                  <button
                    key={option}
                    className={`option-btn-onboarding ${fieldValue === option ? 'selected' : ''}`}
                    onClick={() => handleChange(currentStep.field, option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}

            <button className="btn-primary" onClick={handleNext} disabled={!fieldValue}>
              {step < steps.length - 1 ? 'Next' : 'Complete'}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

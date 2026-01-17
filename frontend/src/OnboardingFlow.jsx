import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const OnboardingFlow = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    pronouns: '',
    location: ''
  });

  const steps = [
    {
      question: "What's your name?",
      field: 'name',
      type: 'text',
      placeholder: 'Enter your name'
    },
    {
      question: "How old are you?",
      field: 'age',
      type: 'number',
      placeholder: 'Enter your age'
    },
    {
      question: "Your pronouns?",
      field: 'pronouns',
      type: 'select',
      options: ['He/Him', 'She/Her', 'They/Them', 'Prefer not to say']
    },
    {
      question: "Where are you from?",
      field: 'location',
      type: 'text',
      placeholder: 'City, Country'
    }
  ];

  const handleNext = () => {
    const currentField = steps[step].field;
    if (!formData[currentField]) {
      alert('Please fill in this field');
      return;
    }

    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(formData);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const currentStep = steps[step];

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <div className="progress-dots">
          {steps.map((_, idx) => (
            <div 
              key={idx} 
              className={`dot ${idx <= step ? 'active' : ''}`}
            />
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
                value={formData[currentStep.field]}
                onChange={(e) => handleChange(currentStep.field, e.target.value)}
                placeholder={currentStep.placeholder}
                className="onboarding-input"
                autoFocus
              />
            ) : currentStep.type === 'select' ? (
              <div className="onboarding-options">
                {currentStep.options.map((option) => (
                  <button
                    key={option}
                    className={`option-btn-onboarding ${formData[currentStep.field] === option ? 'selected' : ''}`}
                    onClick={() => handleChange(currentStep.field, option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}

            <button 
              className="btn-primary" 
              onClick={handleNext}
              disabled={!formData[currentStep.field]}
            >
              {step < steps.length - 1 ? 'Next' : 'Complete'}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OnboardingFlow;

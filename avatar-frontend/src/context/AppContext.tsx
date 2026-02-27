'use client';

/**
 * AppContext — Shared user/session state for the unified frontend.
 * Replaces the top-level useState block from the old React Router App.jsx.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface UserData {
  name: string;
  id: string;
  age?: string;
  gender?: string;
  pronouns?: string;
  location?: string;
  lastAssessment?: any;
  riskLevel?: string;
  lastCheck?: string;
}

interface AppState {
  isOnboarded: boolean;
  userData: UserData | null;
  vibeCheckCompleted: boolean;
  isLoading: boolean;
  riskLevel: 'unknown' | 'low' | 'high';
  handleOnboardingComplete: (data: UserData) => void;
  handleVibeCheckComplete: (report: any) => void;
  resetApp: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [vibeCheckCompleted, setVibeCheckCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [riskLevel, setRiskLevel] = useState<'unknown' | 'low' | 'high'>('unknown');

  useEffect(() => {
    try {
      const savedUserData = localStorage.getItem('humble_safe_user_data');
      const vibeCheckStatus = sessionStorage.getItem('humble_vibe_check_completed');

      if (savedUserData) {
        const parsed = JSON.parse(savedUserData);
        setUserData(parsed);
        setIsOnboarded(true);
        setRiskLevel('unknown');
      }

      if (vibeCheckStatus === 'true') {
        setVibeCheckCompleted(true);
      }
    } catch {
      localStorage.clear();
      sessionStorage.clear();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleOnboardingComplete = useCallback((data: UserData) => {
    setUserData(data);
    setIsOnboarded(true);
    const safeData = { name: data.name, id: data.id || 'anonymous' };
    localStorage.setItem('humble_safe_user_data', JSON.stringify(safeData));
  }, []);

  const handleVibeCheckComplete = useCallback((report: any) => {
    sessionStorage.setItem('humble_vibe_check_completed', 'true');
    setVibeCheckCompleted(true);

    const risk = report.severityScore >= 7 ? 'high' : 'low';
    setRiskLevel(risk);

    setUserData((prev) => {
      const updated: UserData = {
        ...(prev as UserData),
        lastAssessment: report,
        riskLevel: risk,
        lastCheck: new Date().toISOString(),
      };
      const safeData = { name: updated.name, id: updated.id };
      localStorage.setItem('humble_safe_user_data', JSON.stringify(safeData));
      return updated;
    });
  }, []);

  const resetApp = useCallback(() => {
    localStorage.clear();
    sessionStorage.clear();
    setIsOnboarded(false);
    setUserData(null);
    setVibeCheckCompleted(false);
    setRiskLevel('unknown');
  }, []);

  return (
    <AppContext.Provider
      value={{
        isOnboarded,
        userData,
        vibeCheckCompleted,
        isLoading,
        riskLevel,
        handleOnboardingComplete,
        handleVibeCheckComplete,
        resetApp,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}

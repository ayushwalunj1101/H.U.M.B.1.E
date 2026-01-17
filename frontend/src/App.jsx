import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import WelcomePage from './WelcomePage';
import OnboardingFlow from './OnboardingFlow';
import VibeCheck from './VibeCheck';
import Chat from './Chat';
import Header from './Header';
import ImmersiveMode from './ImmersiveMode';
import Assessment from './Assessment';
import Report from './Report';
import './App.css';

function WelcomePageWrapper({ isOnboarded, vibeCheckCompleted }) {
  const navigate = useNavigate();
  
  if (isOnboarded && vibeCheckCompleted) {
    return <Navigate to="/chat" replace />;
  }
  
  if (isOnboarded) {
    return <Navigate to="/vibe-check" replace />;
  }
  
  return (
    <WelcomePage 
      onGetStarted={() => navigate('/onboarding')}
      onSignIn={() => alert('Sign in coming soon')}
    />
  );
}

function App() {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userData, setUserData] = useState(null);
  const [vibeCheckCompleted, setVibeCheckCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [riskLevel, setRiskLevel] = useState('unknown');

  useEffect(() => {
    try {
      const savedUserData = localStorage.getItem('apli_user_data');
      const vibeCheckStatus = localStorage.getItem('apli_vibe_check_completed');
      
      if (savedUserData) {
        const parsed = JSON.parse(savedUserData);
        setUserData(parsed);
        setIsOnboarded(true);
        setRiskLevel(parsed.riskLevel || 'unknown');
      }

      if (vibeCheckStatus === 'true') {
        setVibeCheckCompleted(true);
      }
    } catch (error) {
      console.error('Error loading state:', error);
      localStorage.clear();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleOnboardingComplete = useCallback((data) => {
    setUserData(data);
    setIsOnboarded(true);
    localStorage.setItem('apli_user_data', JSON.stringify(data));
  }, []);

  const handleVibeCheckComplete = useCallback((report) => {
    localStorage.setItem('apli_vibe_check_completed', 'true');
    setVibeCheckCompleted(true);
    
    const risk = report.severityScore >= 7 ? 'high' : 'low';
    setRiskLevel(risk);
    
    setUserData(prev => {
      const updated = {
        ...prev,
        lastAssessment: report,
        riskLevel: risk,
        lastCheck: new Date().toISOString()
      };
      localStorage.setItem('apli_user_data', JSON.stringify(updated));
      return updated;
    });
  }, []);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a24 100%)',
        color: '#6366f1',
        fontFamily: 'system-ui'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>P.O.V</h2>
          <p style={{ color: '#a1a1aa' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/" 
            element={<WelcomePageWrapper isOnboarded={isOnboarded} vibeCheckCompleted={vibeCheckCompleted} />}
          />

          <Route 
            path="/onboarding" 
            element={
              isOnboarded ? (
                <Navigate to="/vibe-check" replace />
              ) : (
                <OnboardingFlow onComplete={handleOnboardingComplete} />
              )
            } 
          />

          <Route 
            path="/vibe-check" 
            element={
              !isOnboarded ? (
                <Navigate to="/onboarding" replace />
              ) : vibeCheckCompleted ? (
                <Navigate to="/chat" replace />
              ) : (
                <VibeCheck 
                  userData={userData} 
                  onComplete={handleVibeCheckComplete}
                />
              )
            } 
          />

          <Route 
            path="/chat" 
            element={
              !isOnboarded ? (
                <Navigate to="/onboarding" replace />
              ) : (
                <>
                  <Header userName={userData?.name} riskLevel={riskLevel} />
                  <main className="main-content">
                    <Chat userData={userData} riskLevel={riskLevel} />
                  </main>
                </>
              )
            } 
          />

          <Route 
            path="/immersive" 
            element={
              <ImmersiveMode 
                userData={userData} 
                onExit={() => window.history.back()}
              />
            } 
          />

          <Route 
            path="/assessment" 
            element={
              <>
                <Header userName={userData?.name} riskLevel={riskLevel} />
                <main className="main-content">
                  <Assessment userData={userData} onComplete={handleVibeCheckComplete} />
                </main>
              </>
            } 
          />

          <Route 
            path="/report" 
            element={
              <>
                <Header userName={userData?.name} riskLevel={riskLevel} />
                <main className="main-content">
                  <Report userData={userData} />
                </main>
              </>
            } 
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

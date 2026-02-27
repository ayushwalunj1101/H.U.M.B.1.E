'use client';
import Header from '@/components/Header';
import Assessment from '@/components/Assessment';
import { useAppContext } from '@/context/AppContext';

export default function AssessmentPage() {
  const { userData, riskLevel, handleVibeCheckComplete } = useAppContext();
  return (
    <>
      <Header userName={userData?.name} riskLevel={riskLevel} />
      <main className="main-content">
        <Assessment userData={userData ?? undefined} onComplete={handleVibeCheckComplete} />
      </main>
    </>
  );
}

'use client';
import Header from '@/components/Header';
import Report from '@/components/Report';
import { useAppContext } from '@/context/AppContext';

export default function ReportPage() {
  const { userData, riskLevel } = useAppContext();
  return (
    <>
      <Header userName={userData?.name} riskLevel={riskLevel} />
      <main className="main-content">
        <Report />
      </main>
    </>
  );
}

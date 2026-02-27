'use client';
import Header from '@/components/Header';
import ChatInterface from '@/components/ChatInterface';
import { useAppContext } from '@/context/AppContext';

export default function ChatPage() {
  const { userData, riskLevel } = useAppContext();
  return (
    <>
      <Header userName={userData?.name} riskLevel={riskLevel} />
      <main className="main-content">
        <ChatInterface />
      </main>
    </>
  );
}

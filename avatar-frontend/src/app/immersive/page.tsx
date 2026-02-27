'use client';
/**
 * /immersive — Full-screen HeyGen streaming avatar therapy session.
 * Uses the production-quality AvatarSession component.
 */
import { useRouter } from 'next/navigation';
import AvatarSession from '@/components/AvatarSession';
import { useAppContext } from '@/context/AppContext';

export default function ImmersivePage() {
  const router = useRouter();
  const { userData } = useAppContext();

  return (
    <div className="immersive-container" style={{ minHeight: '100vh', position: 'relative', background: '#0a0a0f' }}>
      <div className="immersive-top-bar" style={{ position: 'absolute', top: 0, right: 0, zIndex: 10, padding: '1rem' }}>
        <button
          className="immersive-exit"
          onClick={() => router.push('/chat')}
          style={{ padding: '0.5rem 1.5rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', cursor: 'pointer' }}
        >
          Exit
        </button>
      </div>
      <AvatarSession />
    </div>
  );
}

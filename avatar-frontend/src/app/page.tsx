/**
 * Main Page — Voice RAG Avatar Interface
 */
'use client';

import AvatarSession from '@/components/AvatarSession';

export default function Home() {
  return (
    <main className="page">
      <header className="page-header">
        <h1 className="logo">
          <span className="logo-icon">✦</span>
          Aura
        </h1>
        <p className="subtitle">Voice-First Clinical Therapy Agent</p>
      </header>

      <AvatarSession />

      <footer className="page-footer">
        <p>
          ⚠️ This is an AI-assisted tool, not a replacement for professional therapy.
          In crisis, call <strong>Tele-MANAS: 14416</strong> (24/7, Free).
        </p>
      </footer>

      <style jsx>{`
        .page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 20px;
          background: linear-gradient(160deg, #06060e 0%, #0f0f1e 40%, #12121f 100%);
        }

        .page-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .logo {
          font-size: 32px;
          font-weight: 700;
          background: linear-gradient(135deg, #818cf8, #a78bfa, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
        }

        .logo-icon {
          display: inline-block;
          margin-right: 8px;
          animation: sparkle 2s ease-in-out infinite;
        }

        .subtitle {
          color: #64748b;
          font-size: 14px;
          margin-top: 4px;
          letter-spacing: 0.02em;
        }

        .page-footer {
          margin-top: auto;
          padding-top: 32px;
          text-align: center;
          max-width: 480px;
        }

        .page-footer p {
          font-size: 12px;
          color: #475569;
          line-height: 1.5;
        }

        .page-footer strong {
          color: #f59e0b;
        }

        @keyframes sparkle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>
    </main>
  );
}

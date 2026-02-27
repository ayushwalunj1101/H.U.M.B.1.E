import type { Metadata } from 'next';
import './globals.css';
import './frontend.css';
import { AppProvider } from '@/context/AppContext';

export const metadata: Metadata = {
  title: 'H.U.M.B.1.E — Voice-First Mental Health AI',
  description: 'Voice-first AI therapy agent powered by RAG, HeyGen avatar, and clinical assessments',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}

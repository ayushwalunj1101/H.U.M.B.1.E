import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Voice RAG Avatar — Clinical Therapy Agent',
  description: 'Voice-first AI therapy agent powered by RAG and HeyGen Interactive Avatar',
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

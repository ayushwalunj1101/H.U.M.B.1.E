/**
 * Root page — redirects based on onboarding / vibe-check state.
 * Renders WelcomePage for first-time visitors.
 */
'use client';

import WelcomePage from '@/components/WelcomePage';

export default function Home() {
  return <WelcomePage />;
}

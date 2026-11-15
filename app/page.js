import { Suspense } from 'react';
import SteamVaultClient from './SteamVaultClient';

export const metadata = {
  title: 'SteamVault — Library Value, Backlog & Battle Analytics',
  description:
    'Check your Steam account value, unplayed backlog hours, cost per hour, and compare stats against friends.',
  openGraph: {
    title: 'SteamVault — Library Value, Backlog & Battle Analytics',
    description:
      'Uncover your true wallet damage, unplayed backlog hours, and cost-per-hour efficiency.',
    images: [
      {
        url: 'https://steamvault-xi.vercel.app/api/og?name=SteamVault&games=1%2C500%2B&hours=4%2C000%2B&value=Live%20Stats&unplayed=Check%20Yours',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      'https://steamvault-xi.vercel.app/api/og?name=SteamVault&games=1%2C500%2B&hours=4%2C000%2B&value=Live%20Stats&unplayed=Check%20Yours',
    ],
  },
};

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SteamVaultClient />
    </Suspense>
  );
}

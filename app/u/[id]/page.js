import { Suspense } from 'react';
import SteamVaultClient from '../../SteamVaultClient';

const STEAM_API_KEY = process.env.STEAM_API_KEY;

async function getQuickOgData(rawId) {
  if (!rawId || !STEAM_API_KEY) return null;
  try {
    let steamId = decodeURIComponent(rawId).trim();
    if (!/^\d{17}$/.test(steamId)) {
      const res = await fetch(
        `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${encodeURIComponent(steamId)}`
      );
      const data = await res.json();
      if (data.response?.success !== 1) return null;
      steamId = data.response.steamid;
    }

    const [profileRes, gamesRes] = await Promise.all([
      fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`),
      fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_played_free_games=1`),
    ]);

    const [profileData, gamesData] = await Promise.all([
      profileRes.json(),
      gamesRes.json(),
    ]);

    const player = profileData.response?.players?.[0];
    const games = gamesData.response?.games || [];
    if (!player || games.length === 0) return null;

    let totalMins = 0;
    let unplayed = 0;
    for (const g of games) {
      const m = g.playtime_forever || 0;
      totalMins += m;
      if (m === 0) unplayed++;
    }

    return {
      name: player.personaname,
      avatar: player.avatarfull,
      games: games.length.toLocaleString(),
      hours: Math.round(totalMins / 60).toLocaleString(),
      unplayed: `${Math.round((unplayed / games.length) * 100)}%`,
      value: `${unplayed.toLocaleString()} Left`,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const stats = await getQuickOgData(id);
  const baseUrl = 'https://steamvault-xi.vercel.app';

  if (!stats) {
    return { title: 'SteamVault — Library & Wallet Analytics' };
  }

  const ogUrl = `${baseUrl}/api/og?name=${encodeURIComponent(
    stats.name
  )}&avatar=${encodeURIComponent(stats.avatar)}&games=${encodeURIComponent(
    stats.games
  )}&hours=${encodeURIComponent(stats.hours)}&value=${encodeURIComponent(
    stats.value
  )}&unplayed=${encodeURIComponent(stats.unplayed)}`;

  return {
    title: `${stats.name}'s SteamVault — ${stats.games} Games · ${stats.hours}h Played`,
    description: `${stats.name} owns ${stats.games} Steam games (${stats.unplayed} unplayed) with ${stats.hours} hours on record.`,
    openGraph: {
      title: `${stats.name}'s SteamVault Report`,
      description: `${stats.games} games owned • ${stats.hours}h on record • ${stats.unplayed} backlog untouched`,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      images: [ogUrl],
    },
  };
}

export default async function UserProfilePage({ params }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SteamVaultClient initialId={decodeURIComponent(id)} />
    </Suspense>
  );
}

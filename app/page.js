import SteamVaultClient from './SteamVaultClient';

const STEAM_API_KEY = process.env.STEAM_API_KEY;

async function getQuickOgData(rawId) {
  if (!rawId || !STEAM_API_KEY) return null;
  try {
    let steamId = rawId.trim();
    if (!/^\d{17}$/.test(steamId)) {
      const res = await fetch(
        `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${encodeURIComponent(steamId)}`,
        { next: { revalidate: 3600 } }
      );
      const data = await res.json();
      if (data.response?.success !== 1) return null;
      steamId = data.response.steamid;
    }

    const [profileRes, gamesRes] = await Promise.all([
      fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`,
        { next: { revalidate: 3600 } }
      ),
      fetch(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_played_free_games=1`,
        { next: { revalidate: 3600 } }
      ),
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
      games: games.length.toLocaleString(),
      hours: Math.round(totalMins / 60).toLocaleString(),
      unplayed: `${Math.round((unplayed / games.length) * 100)}%`,
      value: `${games.length} Titles`,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ searchParams }) {
  const resolvedParams = await searchParams;
  const id = resolvedParams?.id;
  const baseUrl = 'https://steamvault-xi.vercel.app';

  if (id) {
    const stats = await getQuickOgData(id);
    if (stats) {
      const ogUrl = `${baseUrl}/api/og?name=${encodeURIComponent(
        stats.name
      )}&games=${encodeURIComponent(stats.games)}&hours=${encodeURIComponent(
        stats.hours
      )}&value=${encodeURIComponent(stats.value)}&unplayed=${encodeURIComponent(
        stats.unplayed
      )}`;

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
          title: `${stats.name}'s SteamVault Report`,
          description: `${stats.games} games owned • ${stats.hours}h on record • ${stats.unplayed} backlog untouched`,
          images: [ogUrl],
        },
      };
    }
  }

  return {
    title: 'SteamVault — Library Value, Backlog & Battle Analytics',
    description:
      'Check your Steam account value, unplayed backlog hours, cost per hour, and compare stats against friends.',
  };
}

export default function Page() {
  return <SteamVaultClient />;
}

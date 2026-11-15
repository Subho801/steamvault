import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { HowLongToBeatService } from 'howlongtobeat';

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const CACHE_DIR = process.env.VERCEL ? '/tmp' : process.cwd();
const PRICE_CACHE_FILE = path.join(CACHE_DIR, 'price-cache.json');
const HLTB_CACHE_FILE = path.join(CACHE_DIR, 'hltb-cache.json');
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function redisGet(key) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: 'no-store',
    });
    const data = await res.json();
    return data.result ? JSON.parse(data.result) : null;
  } catch {
    return null;
  }
}

async function redisSet(key, value, ttlSeconds = 86400) {
  if (!KV_URL || !KV_TOKEN) return;
  try {
    await fetch(`${KV_URL}/set/${encodeURIComponent(key)}/EX/${ttlSeconds}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      body: JSON.stringify(value),
    });
  } catch {}
}
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

const hltbService = new HowLongToBeatService();

function loadJson(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error('Cache read error:', err);
  }
  return {};
}

function saveJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Cache write error:', err);
  }
}

async function resolveSteamId(input) {
  if (/^\d{17}$/.test(input)) return input;

  const vanityMatch = input.match(/steamcommunity\.com\/id\/([^\/]+)/);
  const vanityName = vanityMatch ? vanityMatch[1] : input;

  const res = await fetch(
    `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${vanityName}`
  );
  const data = await res.json();
  if (data.response?.success === 1) return data.response.steamid;
  throw new Error('Could not resolve Steam ID');
}

async function fetchPrices(appIds, countryCode = 'IN') {
  const cache = loadJson(PRICE_CACHE_FILE);
  const now = Date.now();
  const priceMap = {};
  const missingIds = [];

  for (const id of appIds) {
    const key = `${countryCode}_${id}`;
    if (cache[key] && now - cache[key].timestamp < CACHE_TTL) {
      priceMap[id] = cache[key].data;
    } else {
      missingIds.push(id);
    }
  }

  const chunkSize = 50;
  let cacheUpdated = false;

  for (let i = 0; i < missingIds.length; i += chunkSize) {
    const chunk = missingIds.slice(i, i + chunkSize).join(',');
    try {
      const res = await fetch(
        `https://store.steampowered.com/api/appdetails?appids=${chunk}&cc=${countryCode}&filters=price_overview`
      );
      const data = await res.json();

      for (const [appId, details] of Object.entries(data || {})) {
        const key = `${countryCode}_${appId}`;
        if (details.success && details.data?.price_overview) {
          const info = {
            initial: details.data.price_overview.initial / 100,
            final: details.data.price_overview.final / 100,
            currency: details.data.price_overview.currency,
          };
          priceMap[appId] = info;
          cache[key] = { timestamp: now, data: info };
          cacheUpdated = true;
        } else if (details.success) {
          const info = { initial: 0, final: 0, currency: null };
          priceMap[appId] = info;
          cache[key] = { timestamp: now, data: info };
          cacheUpdated = true;
        }
      }
    } catch (err) {
      console.error('Price chunk fetch failed:', err);
    }
  }

  if (cacheUpdated) saveJson(PRICE_CACHE_FILE, cache);
  return priceMap;
}

// Fetch HLTB times with local caching (batches up to 35 new games per request so it stays fast)
async function fetchHltbEstimates(unplayedGames) {
  const cache = loadJson(HLTB_CACHE_FILE);
  const results = {};
  const missing = [];

  for (const game of unplayedGames) {
    if (cache[game.appid] !== undefined) {
      results[game.appid] = cache[game.appid];
    } else {
      missing.push(game);
    }
  }

  const toFetch = missing.slice(0, 35);
  let cacheUpdated = false;

  // Fetch in small parallel batches of 5
  for (let i = 0; i < toFetch.length; i += 5) {
    const batch = toFetch.slice(i, i + 5);
    await Promise.all(
      batch.map(async (game) => {
        try {
          const cleanName = game.name.replace(/[™®©]/g, '').trim();
          const searchRes = await hltbService.search(cleanName);
          const bestMatch = searchRes?.[0];

          if (bestMatch && bestMatch.gameplayMain > 0) {
            const entry = {
              main: Math.round(bestMatch.gameplayMain),
              completionist: Math.round(bestMatch.gameplayCompletionist || bestMatch.gameplayMain),
            };
            cache[game.appid] = entry;
            results[game.appid] = entry;
          } else {
            cache[game.appid] = null; // Mark searched so we don't retry failed matches endlessly
            results[game.appid] = null;
          }
          cacheUpdated = true;
        } catch {
          // Ignore temporary HLTB timeout
        }
      })
    );
  }

  if (cacheUpdated) saveJson(HLTB_CACHE_FILE, cache);
  return results;
}

async function hasZeroAchievements(steamId, appId) {
  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&appid=${appId}`
    );
    const data = await res.json();
    const achievements = data.playerstats?.achievements;
    if (!achievements || achievements.length === 0) return false;
    return achievements.every((ach) => ach.achieved === 0);
  } catch {
    return false;
  }
}

async function fetchWishlistStats(steamId, countryCode = 'IN') {
  try {
    const res = await fetch(
      `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?key=${STEAM_API_KEY}&steamid=${steamId}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items = data.response?.items;
    if (!items || items.length === 0) return null;

    // Fetch prices for wishlisted items (reuses your local price cache!)
    const wishlistAppIds = items.map((item) => item.appid);
    const wishlistPrices = await fetchPrices(wishlistAppIds, countryCode);

    let totalCost = 0;
    for (const id of wishlistAppIds) {
      totalCost += wishlistPrices[id]?.final || wishlistPrices[id]?.initial || 0;
    }

    return {
      count: items.length,
      totalValue: Math.round(totalCost),
    };
  } catch {
    return null;
  }
}

async function fetchSteamBackground(steamId) {
  try {
    const res = await fetch(`https://steamcommunity.com/profiles/${steamId}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // 1. Check for animated video background (.webm or .mp4)
    const videoMatch = html.match(
      /<div class="profile_animated_background">[\s\S]*?<source src="([^"]+\.(?:webm|mp4))"/i
    );
    if (videoMatch) {
      return { type: 'video', url: videoMatch[1] };
    }

    // 2. Check for static background image URL in inline CSS
    const imgMatch = html.match(
      /has_profile_background[\s\S]*?background-image:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/i
    );
    if (imgMatch) {
      return { type: 'image', url: imgMatch[1] };
    }

    return null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('id');
  const forceRefresh = searchParams.get('refresh') === '1';

  if (!query) {
    return NextResponse.json({ error: 'Missing Steam ID or username' }, { status: 400 });
  }

  try {
    const steamId = await resolveSteamId(query.trim());

    const cacheKey = `steamvault:profile:${steamId}`;
    if (!forceRefresh) {
      const cached = await redisGet(cacheKey);
      if (cached) {
        return NextResponse.json({ ...cached, cached: true });
      }
    }
    
    const [profileRes, gamesRes, levelRes] = await Promise.all([
      fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`),
      fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`),
      fetch(`https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${STEAM_API_KEY}&steamid=${steamId}`)
    ]);

    const profileData = await profileRes.json();
    const gamesData = await gamesRes.json();
    const levelData = await levelRes.json();

    const player = profileData.response?.players?.[0];
    const games = gamesData.response?.games || [];
    const steamLevel = levelData.response?.player_level || 0;

    if (!player) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (games.length === 0) {
      return NextResponse.json({ error: 'Library is empty or set to Private' }, { status: 403 });
    }

    const countryCode = player.loccountrycode || 'IN';
    const appIds = games.map((g) => g.appid);
    const [prices, wishlist, background] = await Promise.all([
      fetchPrices(appIds, countryCode),
      fetchWishlistStats(steamId, countryCode),
      fetchSteamBackground(steamId),
    ]);

    let totalMinutes = 0;
    let twoWeeksMinutes = 0;
    let neverPlayedCount = 0;
    let totalRetailValue = 0;
    let totalCurrentValue = 0;
    let unplayedValue = 0;
    let currency = countryCode === 'IN' ? 'INR' : 'USD';

    let mostPlayed = { name: 'None', hours: 0 };
    let worstValueGame = { name: 'None', price: 0, minutes: 0 };
    let bestValueGame = { name: 'None', costPerHour: Infinity, hours: 0 };
    const playedGames = [];
    const unplayedList = [];

    for (const game of games) {
      const mins = game.playtime_forever || 0;
      totalMinutes += mins;
      twoWeeksMinutes += game.playtime_2weeks || 0;

      const priceInfo = prices[game.appid];
      const retailPrice = priceInfo?.initial || 0;
      const currentPrice = priceInfo?.final || 0;
      if (priceInfo?.currency) currency = priceInfo.currency;

      totalRetailValue += retailPrice;
      totalCurrentValue += currentPrice;

      if (mins === 0) {
        neverPlayedCount++;
        unplayedValue += retailPrice;
        unplayedList.push({ appid: game.appid, name: game.name, price: retailPrice });
      } else {
        playedGames.push(game);
        const hours = mins / 60;

        if (hours > mostPlayed.hours) {
          mostPlayed = { name: game.name, hours: Math.round(hours) };
        }

        if (mins < 30 && retailPrice > worstValueGame.price) {
          worstValueGame = { name: game.name, price: retailPrice, minutes: mins };
        }

        if (retailPrice > 0 && hours >= 5) {
          const cph = retailPrice / hours;
          if (cph < bestValueGame.costPerHour) {
            bestValueGame = {
              name: game.name,
              costPerHour: Number(cph.toFixed(2)),
              hours: Math.round(hours),
            };
          }
        }
      }
    }

    // Sort unplayed games by highest price first so we prioritize fetching HLTB for major games
    const sortedUnplayed = [...unplayedList].sort((a, b) => b.price - a.price);
    const hltbData = await fetchHltbEstimates(sortedUnplayed);

    let knownMainHours = 0;
    let knownMasterHours = 0;
    let matchedCount = 0;
    let quickWinsCount = 0;
    let longestBacklogGame = { name: 'None', hours: 0 };
    const quickWinTitles = [];

    for (const game of unplayedList) {
      const est = hltbData[game.appid];
      if (est && est.main > 0) {
        matchedCount++;
        knownMainHours += est.main;
        knownMasterHours += est.completionist;

        if (est.main <= 8) {
          quickWinsCount++;
          quickWinTitles.push({ appid: game.appid, name: game.name, hours: est.main });
        }
        if (est.main > longestBacklogGame.hours) {
          longestBacklogGame = { name: game.name, hours: est.main };
        }
      }
    }

    // Extrapolate total hours across all unplayed games based on matched average
    const avgMainPerGame = matchedCount > 0 ? knownMainHours / matchedCount : 12;
    const avgMasterPerGame = matchedCount > 0 ? knownMasterHours / matchedCount : 25;
    const estimatedTotalFinishHours = Math.round(avgMainPerGame * neverPlayedCount);
    const estimatedTotalMasterHours = Math.round(avgMasterPerGame * neverPlayedCount);

    // Calculate calendar time to finish based on 2-week pace (fallback to 15h / 2 weeks if inactive)
    const hoursPerTwoWeeks = twoWeeksMinutes > 0 ? Number((twoWeeksMinutes / 60).toFixed(1)) : 15.0;
    const twoWeekBlocksNeeded = estimatedTotalFinishHours / hoursPerTwoWeeks;
    const totalMonths = Math.round((twoWeekBlocksNeeded * 14) / 30.44);
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;

    const samplePlayed = playedGames.slice(0, 25);
    const achResults = await Promise.all(
      samplePlayed.map((g) => hasZeroAchievements(steamId, g.appid))
    );
    const noAchievementsCount = achResults.filter(Boolean).length;

    const totalHours = Math.round(totalMinutes / 60);
    const costPerHour = totalHours > 0 ? (totalRetailValue / totalHours).toFixed(2) : 0;
    const unplayedPercentage = Math.round((neverPlayedCount / games.length) * 100);

    const library = games.map((g) => {
      const mins = g.playtime_forever || 0;
      const hrs = Number((mins / 60).toFixed(1));
      const priceInfo = prices[g.appid];
      const retailPrice = priceInfo?.initial || 0;

      return {
        appid: g.appid,
        name: g.name,
        minutes: mins,
        hours: hrs,
        price: retailPrice,
      };
    });

    // Top 5 Hall of Fame (most hours played) & Top 5 Hall of Shame (most expensive unplayed)
    const hallOfFame = [...library]
      .filter((g) => g.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5);

    const hallOfShame = [...library]
      .filter((g) => g.minutes === 0 && g.price > 0)
      .sort((a, b) => b.price - a.price)
      .slice(0, 5);

    // Account age & spend per year
    const createdTimestamp = player.timecreated ? player.timecreated * 1000 : null;
    const accountAgeYears = createdTimestamp
      ? Number(((Date.now() - createdTimestamp) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1))
      : null;
    const memberSince = createdTimestamp ? new Date(createdTimestamp).getFullYear() : null;
    const spendPerYear =
      accountAgeYears && accountAgeYears >= 0.5
        ? Math.round(totalRetailValue / accountAgeYears)
        : Math.round(totalRetailValue);

    const finalPayload = {
      profile: {
        steamId: player.steamid,
        name: player.personaname,
        avatar: player.avatarfull,
        country: countryCode,
        level: steamLevel,
        memberSince,
        accountAgeYears,
        background,
      },
      stats: {
        totalGames: games.length,
        totalHours,
        neverPlayed: neverPlayedCount,
        unplayedPercentage,
        noAchievements: noAchievementsCount,
        mostPlayed,
      },
      backlogTime: {
        hoursToFinish: estimatedTotalFinishHours,
        hoursToMaster: estimatedTotalMasterHours,
        matchedGames: matchedCount,
        hoursPerTwoWeeks,
        years,
        months,
        quickWinsCount,
        longestGame: longestBacklogGame.hours > 0 ? longestBacklogGame : null,
      },
      financials: {
        currency,
        totalRetailValue: Math.round(totalRetailValue),
        totalCurrentValue: Math.round(totalCurrentValue),
        unplayedValue: Math.round(unplayedValue),
        costPerHour: Number(costPerHour),
        spendPerYear,
        worstImpulseBuy: worstValueGame.price > 0 ? worstValueGame : null,
      },
      wishlist,
      unplayedGames: unplayedList.map((g) => ({ appid: g.appid, name: g.name })),
      quickWinGames: quickWinTitles,
      hallOfFame,
      hallOfShame,
      library,
    };

    await redisSet(cacheKey, finalPayload, 86400);
    return NextResponse.json(finalPayload);
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to generate receipt' }, { status: 500 });
  }
}

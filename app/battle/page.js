'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

function cleanSlug(raw) {
  const trimmed = raw.trim().replace(/\/+$/, '');
  const idMatch = trimmed.match(/steamcommunity\.com\/id\/([^\/]+)/i);
  if (idMatch) return idMatch[1];
  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (profileMatch) return profileMatch[1];
  return trimmed;
}

export default function BattleArenaPage() {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [data1, setData1] = useState(null);
  const [data2, setData2] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [coopPick, setCoopPick] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q1 = params.get('p1');
    const q2 = params.get('p2');
    if (q1 && q2) {
      setP1(q1);
      setP2(q2);
      startBattle(q1, q2);
    }
  }, []);

  const startBattle = async (id1, id2) => {
    const s1 = cleanSlug(id1);
    const s2 = cleanSlug(id2);
    if (!s1 || !s2) return;
    setLoading(true);
    setError('');
    setCoopPick(null);

    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/steam-receipt?id=${encodeURIComponent(s1)}`),
        fetch(`/api/steam-receipt?id=${encodeURIComponent(s2)}`),
      ]);
      const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
      if (!r1.ok) throw new Error(`Player 1: ${j1.error || 'Failed'}`);
      if (!r2.ok) throw new Error(`Player 2: ${j2.error || 'Failed'}`);

      setData1(j1);
      setData2(j2);
      window.history.replaceState(
        {},
        '',
        `/battle?p1=${encodeURIComponent(s1)}&p2=${encodeURIComponent(s2)}`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency) =>
    new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(amount);

  // Compute Shared Games Overlap
  const sharedGames = (() => {
    if (!data1?.library || !data2?.library) return [];
    const map2 = new Map(data2.library.map((g) => [g.appid, g]));
    const mutual = [];
    for (const g1 of data1.library) {
      const g2 = map2.get(g1.appid);
      if (g2) {
        mutual.push({
          appid: g1.appid,
          name: g1.name,
          h1: g1.hours,
          h2: g2.hours,
          combined: g1.hours + g2.hours,
        });
      }
    }
    return mutual.sort((a, b) => b.combined - a.combined);
  })();

  const spinMutualGame = () => {
    if (!sharedGames.length) return;
    setCoopPick(sharedGames[Math.floor(Math.random() * sharedGames.length)]);
  };

  return (
    <main className="min-h-screen py-10 px-4 flex flex-col items-center">
      {/* Shared Top Navbar */}
      <div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-4 mb-8">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="SteamVault"
            className="w-10 h-10 rounded-2xl object-cover border border-white/25 shadow-lg"
          />
          <div>
            <span className="font-bold text-lg tracking-tight text-slate-100">SteamVault</span>
            <span className="block text-[11px] text-slate-400 -mt-0.5">
              Library &amp; Wallet Analytics
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-2 text-xs font-semibold">
          <Link
            href="/"
            className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            Scanner
          </Link>
          <Link
            href="/battle"
            className="px-3.5 py-2 rounded-xl bg-white/15 text-white border border-white/25"
          >
            1v1 Battle
          </Link>
          <Link
            href="/leaderboard"
            className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            Leaderboard
          </Link>
          <Link
            href="/badges"
            className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            Badges
          </Link>
        </nav>
      </div>

      {/* Battle Form */}
      <div className="w-full max-w-4xl glossy-panel rounded-3xl p-6 sm:p-8 mb-6">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-violet-300">
          1v1 Showdown Arena
        </span>
        <h1 className="text-2xl font-bold text-slate-100 mt-1 mb-5">
          Compare Two Steam Vaults &amp; Find Mutual Games
        </h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            startBattle(p1, p2);
          }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <input
            type="text"
            placeholder="Player 1 (e.g. subho7)"
            value={p1}
            onChange={(e) => setP1(e.target.value)}
            className="px-4 py-3 rounded-2xl bg-slate-950/60 border border-white/12 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-300/60"
          />
          <input
            type="text"
            placeholder="Player 2 (e.g. callmeabrix)"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            className="px-4 py-3 rounded-2xl bg-slate-950/60 border border-white/12 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-300/60"
          />
          <button
            type="submit"
            disabled={loading}
            className="glossy-btn py-3 rounded-2xl font-bold text-xs text-slate-950 bg-gradient-to-r from-sky-300 via-indigo-300 to-violet-300 border border-white/50 cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Comparing Vaults...' : '⚔️ Fight!'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-400/10 border border-rose-300/25 text-xs text-rose-200">
            {error}
          </div>
        )}
      </div>

      {/* Battle Results */}
      {data1 && data2 && (
        <div className="w-full max-w-4xl space-y-6">
          <div className="glossy-panel rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {[data1, data2].map((player, idx) => (
                <Link
                  key={player.profile.steamId}
                  href={`/u/${player.profile.steamId}`}
                  className={`glossy-card ${
                    idx === 0 ? 'glow-sky' : 'glow-violet'
                  } rounded-2xl p-4 flex items-center gap-3.5`}
                >
                  <img
                    src={player.profile.avatar}
                    alt={player.profile.name}
                    className="w-14 h-14 rounded-xl object-cover ring-1 ring-white/25"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-100 truncate">{player.profile.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      LVL {player.profile.level} • {player.stats.totalGames.toLocaleString()} games
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="space-y-3">
              {[
                {
                  label: 'Total Games Owned',
                  v1: data1.stats.totalGames,
                  v2: data2.stats.totalGames,
                  fmt: (v) => v.toLocaleString(),
                  higherWins: true,
                },
                {
                  label: 'Total Hours Played',
                  v1: data1.stats.totalHours,
                  v2: data2.stats.totalHours,
                  fmt: (v) => `${v.toLocaleString()}h`,
                  higherWins: true,
                },
                {
                  label: 'Est. Library Value',
                  v1: data1.financials.totalRetailValue,
                  v2: data2.financials.totalRetailValue,
                  fmt: (v, p) => formatCurrency(v, p.financials.currency),
                  higherWins: true,
                },
                {
                  label: 'Unplayed Shame Value',
                  v1: data1.financials.unplayedValue,
                  v2: data2.financials.unplayedValue,
                  fmt: (v, p) => formatCurrency(v, p.financials.currency),
                  higherWins: false,
                },
                {
                  label: 'Backlog Unplayed %',
                  v1: data1.stats.unplayedPercentage,
                  v2: data2.stats.unplayedPercentage,
                  fmt: (v) => `${v}%`,
                  higherWins: false,
                },
              ].map((row) => {
                const p1Wins = row.higherWins ? row.v1 > row.v2 : row.v1 < row.v2;
                const p2Wins = row.higherWins ? row.v2 > row.v1 : row.v2 < row.v1;

                return (
                  <div
                    key={row.label}
                    className="glossy-card glow-sky rounded-2xl px-4 py-3.5 grid grid-cols-3 items-center text-center"
                  >
                    <div
                      className={`text-base sm:text-lg font-bold ${
                        p1Wins ? 'text-sky-200' : 'text-slate-400'
                      }`}
                    >
                      {row.fmt(row.v1, data1)} {p1Wins && '👑'}
                    </div>
                    <div className="text-xs font-medium text-slate-400">{row.label}</div>
                    <div
                      className={`text-base sm:text-lg font-bold ${
                        p2Wins ? 'text-violet-200' : 'text-slate-400'
                      }`}
                    >
                      {p2Wins && '👑'} {row.fmt(row.v2, data2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shared Games Overlap & Co-op Roulette */}
          <div className="glossy-panel rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
                  Library Overlap
                </span>
                <h2 className="text-lg font-bold text-slate-100 mt-0.5">
                  {sharedGames.length.toLocaleString()} Mutual Games Owned by Both
                </h2>
                {coopPick && (
                  <p className="text-xs text-sky-200 mt-1">
                    🎲 Play together next: <strong>{coopPick.name}</strong> ({coopPick.h1}h vs{' '}
                    {coopPick.h2}h)
                  </p>
                )}
              </div>

              {sharedGames.length > 0 && (
                <button
                  onClick={spinMutualGame}
                  className="glossy-btn px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 text-xs font-bold text-slate-950 shrink-0 cursor-pointer"
                >
                  🎲 Spin Mutual Game
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {sharedGames.slice(0, 12).map((g) => (
                <div
                  key={g.appid}
                  className="glossy-card glow-sky rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                >
                  <span className="text-xs font-semibold text-slate-100 truncate">{g.name}</span>
                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <span className="text-sky-200 font-bold">{g.h1}h</span>
                    <span className="text-slate-500">vs</span>
                    <span className="text-violet-200 font-bold">{g.h2}h</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

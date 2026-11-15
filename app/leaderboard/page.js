'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LeaderboardPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/steam-receipt?leaderboard=1');
        const json = await res.json();
        setEntries(json.leaderboard || []);
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const formatCurrency = (amount, currency) =>
    new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(amount);

  const sorted = [...entries].sort((a, b) => {
    if (sortBy === 'value') return b.totalRetailValue - a.totalRetailValue;
    if (sortBy === 'hours') return b.totalHours - a.totalHours;
    if (sortBy === 'games') return b.totalGames - a.totalGames;
    if (sortBy === 'shame') return b.unplayedValue - a.unplayedValue;
    return (b.scannedAt || 0) - (a.scannedAt || 0);
  });

  return (
    <main className="min-h-screen py-10 px-4 flex flex-col items-center">
      {/* Shared Top Navbar */}
      <div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-4 mb-8">
        <Link href="/" className="flex items-center gap-3 group">
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
            className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            1v1 Battle
          </Link>
          <Link
            href="/leaderboard"
            className="px-3.5 py-2 rounded-xl bg-white/15 text-white border border-white/25"
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

      <div className="w-full max-w-4xl glossy-panel rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/12">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-sky-300">
              Global Vault Rankings
            </span>
            <h1 className="text-2xl font-bold text-slate-100 mt-0.5">
              SteamVault Leaderboard &amp; Recent Scans
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Click any profile to inspect their full receipt and equipped Steam background.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'recent', label: 'Recent' },
              { id: 'value', label: 'Highest Value' },
              { id: 'hours', label: 'Most Hours' },
              { id: 'games', label: 'Most Games' },
              { id: 'shame', label: 'Biggest Shame' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSortBy(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  sortBy === tab.id
                    ? 'bg-sky-400/20 text-sky-200 border border-sky-300/35'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">
            Loading global leaderboard...
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-slate-300">No profiles scanned yet since leaderboard went live!</p>
            <Link
              href="/"
              className="inline-block px-5 py-2.5 rounded-xl bg-sky-300 text-slate-950 text-xs font-bold"
            >
              Scan First Profile →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((user, idx) => (
              <Link
                key={user.steamId}
                href={`/u/${user.steamId}`}
                className="glossy-card glow-sky rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-sky-300/40 transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-7 text-center text-sm font-extrabold text-sky-300 shrink-0">
                    #{idx + 1}
                  </span>
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-12 h-12 rounded-xl object-cover ring-1 ring-white/25 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 truncate">{user.name}</span>
                      {user.level > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-slate-300 font-semibold">
                          LVL {user.level}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                      {user.totalGames.toLocaleString()} games • {user.totalHours.toLocaleString()}h •{' '}
                      {user.unplayedPercentage}% unplayed
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 sm:text-right pl-10 sm:pl-0">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                      Vault Value
                    </span>
                    <span className="text-sm font-bold text-emerald-300">
                      {formatCurrency(user.totalRetailValue, user.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                      Shame Value
                    </span>
                    <span className="text-sm font-bold text-rose-300">
                      {formatCurrency(user.unplayedValue, user.currency)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

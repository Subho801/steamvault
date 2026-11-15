'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';

function GameCover({ appid, name, className }) {
  const [src, setSrc] = useState(
    `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`
  );
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-xs text-slate-500 px-3 text-center">
        {name}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (src.includes('shared.cloudflare')) {
          setSrc(`https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`);
        } else {
          setFailed(true);
        }
      }}
      className={className}
    />
  );
}

export default function LibraryPage({ params }) {
  const resolvedParams = use(params);
  const id = decodeURIComponent(resolvedParams.id);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [libraryFilter, setLibraryFilter] = useState('all');
  const [librarySort, setLibrarySort] = useState('hours-desc');
  const [visibleCount, setVisibleCount] = useState(24);

  useEffect(() => {
    async function loadLibrary() {
      setLoading(true);
      try {
        const res = await fetch(`/api/steam-receipt?id=${encodeURIComponent(id)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load library');
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadLibrary();
  }, [id]);

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const filtered = (data?.library || [])
    .filter((g) => {
      if (searchTerm && !g.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (libraryFilter === 'unplayed') return g.minutes === 0;
      if (libraryFilter === 'played') return g.minutes > 0;
      if (libraryFilter === 'paid') return g.price > 0;
      return true;
    })
    .sort((a, b) => {
      if (librarySort === 'hours-desc') return b.minutes - a.minutes;
      if (librarySort === 'price-desc') return b.price - a.price;
      return a.name.localeCompare(b.name);
    });

  const shown = filtered.slice(0, visibleCount);

  return (
    <main className="min-h-screen py-10 px-4 flex flex-col items-center">
      {/* Top Navigation */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-8">
        <Link
          href={`/u/${encodeURIComponent(id)}`}
          className="px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/15 text-xs font-semibold text-sky-200 transition-colors"
        >
          ← Back to {data?.profile?.name ? `${data.profile.name}'s Report` : 'Report'}
        </Link>

        <span className="text-xs font-semibold uppercase tracking-widest text-violet-300">
          SteamVault Library Explorer
        </span>
      </div>

      {loading && (
        <div className="w-full max-w-5xl rounded-3xl bg-slate-900/80 border border-white/10 p-12 text-center text-sm text-slate-300">
          Loading library...
        </div>
      )}

      {error && (
        <div className="w-full max-w-5xl rounded-2xl bg-rose-500/10 border border-rose-400/25 p-5 text-xs text-rose-200">
          {error}
        </div>
      )}

      {data && (
        <div className="w-full max-w-5xl rounded-3xl bg-slate-900/85 border border-white/12 p-6 sm:p-8 space-y-6 shadow-2xl">
          {/* Header + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
                {data.profile.name}&apos;s Library ({data.library.length.toLocaleString()} Games)
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Filter, sort, and launch any game directly in Steam.
              </p>
            </div>

            <input
              type="text"
              placeholder="Search game title..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setVisibleCount(24);
              }}
              className="w-full sm:w-64 px-4 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-300/60"
            />
          </div>

          {/* Filter Pills & Sort */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All Games' },
                { id: 'unplayed', label: 'Never Played' },
                { id: 'played', label: 'Played' },
                { id: 'paid', label: 'Paid Only' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setLibraryFilter(tab.id);
                    setVisibleCount(24);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    libraryFilter === tab.id
                      ? 'bg-sky-400/20 text-sky-200 border border-sky-300/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              value={librarySort}
              onChange={(e) => setLibrarySort(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="hours-desc">Sort: Most Played</option>
              <option value="price-desc">Sort: Highest Price</option>
              <option value="name-asc">Sort: Name (A–Z)</option>
            </select>
          </div>

          <div className="text-xs text-slate-400">
            Showing {shown.length} of {filtered.length.toLocaleString()} matching titles
          </div>

          {/* Lightweight 60fps Game Grid (No heavy backdrop-blur per card) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shown.map((game) => (
              <div
                key={game.appid}
                className="rounded-2xl bg-slate-950/80 border border-white/10 hover:border-sky-300/40 transition-colors overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-28 w-full bg-slate-900 overflow-hidden">
                    <GameCover
                      appid={game.appid}
                      name={game.name}
                      className="w-full h-full object-cover"
                    />
                    <span
                      className={`absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                        game.minutes === 0
                          ? 'bg-rose-950/90 border-rose-400/30 text-rose-200'
                          : 'bg-slate-950/90 border-white/20 text-sky-200'
                      }`}
                    >
                      {game.minutes === 0 ? 'Unplayed' : `${game.hours}h played`}
                    </span>
                  </div>

                  <div className="p-4">
                    <h4
                      className="font-semibold text-sm text-slate-100 truncate"
                      title={game.name}
                    >
                      {game.name}
                    </h4>
                    <div className="text-xs text-slate-400 mt-1">
                      {game.price > 0
                        ? formatCurrency(game.price, data.financials.currency)
                        : 'Free / Delisted'}
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-1 flex items-center justify-between gap-2">
                  <a
                    href={`https://store.steampowered.com/app/${game.appid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Store Page ↗
                  </a>
                  <a
                    href={`steam://run/${game.appid}`}
                    className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-semibold text-sky-200 transition-colors"
                  >
                    ▶ Launch
                  </a>
                </div>
              </div>
            ))}
          </div>

          {visibleCount < filtered.length && (
            <div className="pt-3 text-center">
              <button
                onClick={() => setVisibleCount((prev) => prev + 24)}
                className="px-6 py-2.5 rounded-xl bg-violet-400/15 hover:bg-violet-400/25 border border-violet-300/30 text-xs font-semibold text-violet-200 transition-colors cursor-pointer"
              >
                Load More ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

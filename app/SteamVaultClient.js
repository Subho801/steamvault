'use client';

import { useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';

function cleanQuerySlug(raw) {
  const trimmed = raw.trim().replace(/\/+$/, '');
  const idMatch = trimmed.match(/steamcommunity\.com\/id\/([^\/]+)/i);
  if (idMatch) return idMatch[1];
  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (profileMatch) return profileMatch[1];
  return trimmed;
}

function GameCover({ appid, name, className }) {
  const [src, setSrc] = useState(
    `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`
  );
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
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

export default function SteamVaultClient({ initialId }) {
  const [mode, setMode] = useState('single');
  const [query, setQuery] = useState('');
  const [query2, setQuery2] = useState('');

  const [data, setData] = useState(null);
  const [data2, setData2] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [rouletteGame, setRouletteGame] = useState(null);
  const [quickWinOnly, setQuickWinOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [libraryFilter, setLibraryFilter] = useState('all');
  const [librarySort, setLibrarySort] = useState('hours-desc');
  const [visibleCount, setVisibleCount] = useState(24);

  const cardRef = useRef(null);

  const handleCardMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  useEffect(() => {
    if (initialId) {
    setMode('single');
    setQuery(initialId);
    runSingleScan(initialId);
    return;
  }
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    const p1 = params.get('p1');
    const p2 = params.get('p2');

    if (p1 && p2) {
      setMode('battle');
      setQuery(p1);
      setQuery2(p2);
      runBattleScan(p1, p2);
    } else if (idParam) {
      setMode('single');
      setQuery(idParam);
      runSingleScan(idParam);
    }
  }, [initialId]);

  const runSingleScan = async (targetId, forceRefresh = false) => {
    const slug = cleanQuerySlug(targetId);
    if (!slug) return;
    setLoading(true);
    setError('');
    setRouletteGame(null);

    try {
      const res = await fetch(
        `/api/steam-receipt?id=${encodeURIComponent(slug)}${forceRefresh ? '&refresh=1' : ''}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to scan Steam profile');
      setData(json);
      setData2(null);
      window.history.replaceState({}, '', `/u/${encodeURIComponent(slug)}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const runBattleScan = async (id1, id2) => {
    const slug1 = cleanQuerySlug(id1);
    const slug2 = cleanQuerySlug(id2);
    if (!slug1 || !slug2) return;
    setLoading(true);
    setError('');

    try {
      const [res1, res2] = await Promise.all([
        fetch(`/api/steam-receipt?id=${encodeURIComponent(slug1)}`),
        fetch(`/api/steam-receipt?id=${encodeURIComponent(slug2)}`),
      ]);
      const [json1, json2] = await Promise.all([res1.json(), res2.json()]);

      if (!res1.ok) throw new Error(`Player 1: ${json1.error || 'Failed'}`);
      if (!res2.ok) throw new Error(`Player 2: ${json2.error || 'Failed'}`);

      setData(json1);
      setData2(json2);
      window.history.replaceState(
        {},
        '',
        `?p1=${encodeURIComponent(slug1)}&p2=${encodeURIComponent(slug2)}`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'single') {
      runSingleScan(query);
    } else {
      runBattleScan(query, query2);
    }
  };

  const resetHome = () => {
    setData(null);
    setData2(null);
    setError('');
    window.history.replaceState({}, '', '/');
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadImage = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#0d121e',
      });
      const link = document.createElement('a');
      link.download = data2
        ? `steam-battle-${data.profile.name}-vs-${data2.profile.name}.png`
        : `steam-vault-${data.profile.name}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const spinRoulette = () => {
    const pool =
      quickWinOnly && data?.quickWinGames?.length > 0
        ? data.quickWinGames
        : data?.unplayedGames || [];
    if (!pool.length) return;
    const random = pool[Math.floor(Math.random() * pool.length)];
    setRouletteGame(random);
  };

  const getPersona = (stats) => {
    if (stats.unplayedPercentage >= 75)
      return {
        label: 'Digital Hoarder',
        style: 'from-violet-400/25 to-fuchsia-400/25 border-violet-300/35 text-violet-200',
      };
    if (stats.unplayedPercentage >= 50)
      return {
        label: 'Steam Sale Victim',
        style: 'from-amber-400/25 to-rose-400/25 border-amber-300/35 text-amber-200',
      };
    if (stats.totalHours > 3000)
      return {
        label: 'Certified No-Lifer',
        style: 'from-sky-400/25 to-indigo-400/25 border-sky-300/35 text-sky-200',
      };
    return {
      label: 'Disciplined Gamer',
      style: 'from-emerald-400/25 to-teal-400/25 border-emerald-300/35 text-emerald-200',
    };
  };

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <main className="min-h-screen py-10 px-4 flex flex-col items-center">
      {/* Top Brand Header */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-8">
        <button
          onClick={resetHome}
          className="flex items-center gap-3 text-left cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-300 via-indigo-300 to-violet-300 border border-white/50 flex items-center justify-center font-black text-slate-900 shadow-lg shadow-sky-400/20 transition-transform duration-300 group-hover:scale-105">
            SV
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-slate-100 group-hover:text-white transition-colors">
              SteamVault
            </span>
            <span className="block text-[11px] text-slate-400 -mt-0.5">
              Library &amp; Wallet Analytics
            </span>
          </div>
        </button>

        {data && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={resetHome}
              onMouseMove={handleCardMove}
              className="glossy-btn glossy-card glow-sky px-3.5 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white cursor-pointer"
            >
              ← New Scan
            </button>
            <button
              onClick={copyShareLink}
              onMouseMove={handleCardMove}
              className="glossy-btn glossy-card glow-sky px-3.5 py-2 rounded-xl text-xs font-medium text-sky-200 hover:text-white cursor-pointer"
            >
              {copied ? '✓ Copied!' : 'Share Link'}
            </button>
            <button
              onClick={downloadImage}
              className="glossy-btn px-4 py-2 rounded-xl bg-gradient-to-r from-sky-300 to-indigo-300 border border-white/50 text-xs font-semibold text-slate-950 shadow-lg shadow-sky-400/20 cursor-pointer"
            >
              Save Image
            </button>
          </div>
        )}
      </div>

      {/* Landing Search Box */}
      {!data && (
        <div className="w-full max-w-lg mt-8 glossy-panel rounded-3xl p-7 sm:p-9">
          <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-slate-950/50 border border-white/10 mb-7">
            <button
              type="button"
              onClick={() => {
                setMode('single');
                setError('');
              }}
              className={`py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer ${
                mode === 'single'
                  ? 'bg-white/15 text-white border border-white/25 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Single Profile
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('battle');
                setError('');
              }}
              className={`py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer ${
                mode === 'battle'
                  ? 'bg-white/15 text-white border border-white/25 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1v1 Friend Battle
            </button>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 mb-2">
            {mode === 'single' ? 'Inspect Your Steam Vault' : 'Compare Steam Libraries'}
          </h1>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            {mode === 'single'
              ? 'A calm, clear look at your library value, unplayed backlog hours, and cost-per-hour efficiency.'
              : 'Compare two Steam profiles side-by-side to see who owns more and plays more.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {mode === 'single' ? 'SteamID64, Custom URL, or Profile Link' : 'Player 1 Steam ID'}
              </label>
              <input
                type="text"
                placeholder="e.g. 76561199502362088 or gaben"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-950/55 border border-white/12 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-300/60 focus:bg-slate-950/75 transition-all"
              />
            </div>

            {mode === 'battle' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Player 2 Steam ID
                </label>
                <input
                  type="text"
                  placeholder="Enter friend's SteamID or custom name"
                  value={query2}
                  onChange={(e) => setQuery2(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-950/55 border border-white/12 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-300/60 focus:bg-slate-950/75 transition-all"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="glossy-btn w-full py-3.5 rounded-2xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-sky-300 via-indigo-300 to-violet-300 border border-white/50 shadow-lg shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
            >
              {loading
                ? 'Scanning Steam Servers...'
                : mode === 'single'
                ? 'Analyze My Account'
                : 'Start 1v1 Comparison'}
            </button>
          </form>

          {error && (
            <div className="mt-5 p-3.5 rounded-2xl bg-rose-400/10 border border-rose-300/25 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>
      )}

      {/* SINGLE PROFILE GLOSSY DASHBOARD */}
      {data && !data2 && (
        <div className="w-full max-w-4xl space-y-6">
          <div ref={cardRef} className="glossy-panel rounded-3xl p-6 sm:p-8 space-y-7">
            {/* Profile Hero Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/12">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <img
                    src={data.profile.avatar}
                    alt={data.profile.name}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-white/25 shadow-xl transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-lg bg-slate-900/90 border border-white/25 text-[10px] font-semibold text-sky-200 backdrop-blur-md">
                    {data.profile.country}
                  </span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold text-slate-100">{data.profile.name}</h2>
                    {data.profile.level > 0 && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-white/10 border border-white/20 text-slate-200">
                        LVL {data.profile.level}
                      </span>
                    )}
                    <span
                      className={`text-[11px] px-3 py-0.5 rounded-full font-semibold border bg-gradient-to-r backdrop-blur-md ${
                        getPersona(data.stats).style
                      }`}
                    >
                      {getPersona(data.stats).label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {data.profile.memberSince && (
                      <>
                        Since <span className="text-slate-200 font-medium">{data.profile.memberSince}</span> ({data.profile.accountAgeYears}y) •{' '}
                      </>
                    )}
                    <span className="text-slate-200 font-medium">
                      {data.stats.totalGames.toLocaleString()} games
                    </span>{' '}
                    •{' '}
                    <span className="text-sky-200 font-medium">
                      {data.stats.totalHours.toLocaleString()}h played
                    </span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => runSingleScan(data.profile.steamId, true)}
                onMouseMove={handleCardMove}
                disabled={loading}
                className="glossy-btn glossy-card glow-sky self-start sm:self-center px-3.5 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white cursor-pointer"
              >
                {loading ? 'Refreshing...' : '↻ Rescan'}
              </button>
            </div>

            {/* Wallet Damage Highlight Cards */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3.5">
                Wallet &amp; Value Analytics
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onMouseMove={handleCardMove}
                  className="glossy-card glow-sky rounded-2xl p-5"
                >
                  <span className="text-xs text-slate-400">Est. Library Value</span>
                  <div className="text-2xl font-bold text-slate-100 mt-1">
                    {formatCurrency(data.financials.totalRetailValue, data.financials.currency)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Current: {formatCurrency(data.financials.totalCurrentValue, data.financials.currency)}
                  </span>
                </div>

                <div
                  onMouseMove={handleCardMove}
                  className="glossy-card glow-rose rounded-2xl p-5 bg-gradient-to-br from-rose-300/[0.08] to-transparent"
                >
                  <span className="text-xs text-rose-200/85">Unplayed Shame Value</span>
                  <div className="text-2xl font-bold text-rose-300 mt-1">
                    {formatCurrency(data.financials.unplayedValue, data.financials.currency)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    0 minutes on record
                  </span>
                </div>

                <div
                  onMouseMove={handleCardMove}
                  className="glossy-card glow-emerald rounded-2xl p-5 bg-gradient-to-br from-emerald-300/[0.08] to-transparent"
                >
                  <span className="text-xs text-emerald-200/85">Cost Per Hour</span>
                  <div className="text-2xl font-bold text-emerald-300 mt-1">
                    {formatCurrency(data.financials.costPerHour, data.financials.currency)}
                    <span className="text-sm font-normal text-emerald-200/70">/hr</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    ~{formatCurrency(data.financials.spendPerYear, data.financials.currency)}/yr avg
                  </span>
                </div>

                <div
                  onMouseMove={handleCardMove}
                  className="glossy-card glow-violet rounded-2xl p-5 bg-gradient-to-br from-violet-300/[0.08] to-transparent"
                >
                  <span className="text-xs text-violet-200/85">Most Played</span>
                  <div className="text-base font-semibold text-slate-100 truncate mt-1.5">
                    {data.stats.mostPlayed.name}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1.5 block">
                    {data.stats.mostPlayed.hours.toLocaleString()} hours logged
                  </span>
                </div>
              </div>
            </div>

            {/* Backlog & Completion Analytics */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3.5">
                Backlog &amp; Time-to-Beat
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onMouseMove={handleCardMove}
                  className="glossy-card glow-violet rounded-2xl p-5"
                >
                  <span className="text-xs text-slate-400">Never Played</span>
                  <div className="text-2xl font-bold text-slate-100 mt-1">
                    {data.stats.neverPlayed}
                  </div>
                  <div className="w-full bg-slate-900/80 h-1.5 rounded-full mt-2.5 overflow-hidden border border-white/10">
                    <div
                      className="bg-gradient-to-r from-sky-300 to-violet-300 h-full rounded-full transition-all duration-700"
                      style={{ width: `${data.stats.unplayedPercentage}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1.5 block">
                    {data.stats.unplayedPercentage}% of library untouched
                  </span>
                </div>

                <div
                  onMouseMove={handleCardMove}
                  className="glossy-card glow-sky rounded-2xl p-5"
                >
                  <span className="text-xs text-slate-400">Hours to Finish</span>
                  <div className="text-2xl font-bold text-sky-200 mt-1">
                    {data.backlogTime.hoursToFinish.toLocaleString()}h
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {data.backlogTime.hoursToMaster.toLocaleString()}h to 100% master
                  </span>
                </div>

                <div
                  onMouseMove={handleCardMove}
                  className="glossy-card glow-amber rounded-2xl p-5"
                >
                  <span className="text-xs text-slate-400">Est. Completion Time</span>
                  <div className="text-2xl font-bold text-amber-200 mt-1">
                    {data.backlogTime.years}y {data.backlogTime.months}mo
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    at {data.backlogTime.hoursPerTwoWeeks}h / 2 weeks pace
                  </span>
                </div>

                <div
                  onMouseMove={handleCardMove}
                  className="glossy-card glow-sky rounded-2xl p-5"
                >
                  <span className="text-xs text-slate-400">Zero Achievements</span>
                  <div className="text-2xl font-bold text-slate-200 mt-1">
                    {data.stats.noAchievements}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    launched, 0 unlocked
                  </span>
                </div>
              </div>
            </div>

            {/* Glossy Highlight Pills */}
            <div className="flex flex-wrap gap-2.5 pt-1">
              <span
                onMouseMove={handleCardMove}
                className="glossy-card glow-sky px-3.5 py-1.5 rounded-full text-xs text-sky-200"
              >
                ⚡ <strong>{data.backlogTime.quickWinsCount}</strong> quick wins (&le;8h)
              </span>

              {data.wishlist && data.wishlist.count > 0 && (
                <span
                  onMouseMove={handleCardMove}
                  className="glossy-card glow-amber px-3.5 py-1.5 rounded-full text-xs text-amber-200"
                >
                  🛒 Wishlist: <strong>{data.wishlist.count} games</strong> (
                  {formatCurrency(data.wishlist.totalValue, data.financials.currency)} pending)
                </span>
              )}

              {data.backlogTime.longestGame && (
                <span
                  onMouseMove={handleCardMove}
                  className="glossy-card glow-violet px-3.5 py-1.5 rounded-full text-xs text-violet-200"
                >
                  🏔️ Longest backlog: <strong>{data.backlogTime.longestGame.name}</strong> (
                  {data.backlogTime.longestGame.hours}h)
                </span>
              )}

              {data.financials.worstImpulseBuy && (
                <span
                  onMouseMove={handleCardMove}
                  className="glossy-card glow-rose px-3.5 py-1.5 rounded-full text-xs text-rose-200"
                >
                  💸 Worst impulse: <strong>{data.financials.worstImpulseBuy.name}</strong> (
                  {formatCurrency(data.financials.worstImpulseBuy.price, data.financials.currency)} for{' '}
                  {data.financials.worstImpulseBuy.minutes}m)
                </span>
              )}
            </div>
          </div>

          {/* Hall of Fame vs Hall of Shame Top 5 Podium */}
          {(data.hallOfFame?.length > 0 || data.hallOfShame?.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top 5 Most Played */}
              <div className="glossy-panel rounded-3xl p-6 space-y-4">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-sky-300">
                    Hall of Fame
                  </span>
                  <h3 className="text-base font-bold text-slate-100">
                    Top 5 Most Played Titles
                  </h3>
                </div>
                <div className="space-y-2.5">
                  {data.hallOfFame.map((game, index) => (
                    <div
                      key={game.appid}
                      onMouseMove={handleCardMove}
                      className="glossy-card glow-sky rounded-2xl p-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 text-center text-xs font-bold text-sky-300">
                          #{index + 1}
                        </span>
                        <GameCover
                          appid={game.appid}
                          name={game.name}
                          className="w-16 h-7 rounded-lg object-cover bg-slate-900 shrink-0"
                        />
                        <span className="text-xs font-semibold text-slate-100 truncate">
                          {game.name}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-sky-200 shrink-0 pr-1">
                        {game.hours}h
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 5 Expensive Unplayed */}
              <div className="glossy-panel rounded-3xl p-6 space-y-4">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-rose-300">
                    Hall of Shame
                  </span>
                  <h3 className="text-base font-bold text-slate-100">
                    Top 5 Priciest Unplayed Games
                  </h3>
                </div>
                <div className="space-y-2.5">
                  {data.hallOfShame.map((game, index) => (
                    <div
                      key={game.appid}
                      onMouseMove={handleCardMove}
                      className="glossy-card glow-rose rounded-2xl p-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 text-center text-xs font-bold text-rose-300">
                          #{index + 1}
                        </span>
                        <GameCover
                          appid={game.appid}
                          name={game.name}
                          className="w-16 h-7 rounded-lg object-cover bg-slate-900 shrink-0"
                        />
                        <span className="text-xs font-semibold text-slate-100 truncate">
                          {game.name}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-rose-300 shrink-0 pr-1">
                        {formatCurrency(game.price, data.financials.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Interactive Backlog Roulette Card */}
          {data.unplayedGames?.length > 0 && (
            <div className="glossy-panel rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-widest text-sky-300">
                  Backlog Roulette
                </span>
                {rouletteGame ? (
                  <div className="text-lg font-semibold text-slate-100 mt-0.5">
                    🎯 Next up: <span className="text-sky-200">{rouletteGame.name}</span>{' '}
                    {rouletteGame.hours ? (
                      <span className="text-xs font-normal text-slate-400">
                        (~{rouletteGame.hours}h to beat)
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-slate-300 mt-0.5">
                    Can&apos;t decide? Spin a random game from your {data.unplayedGames.length}{' '}
                    unplayed titles.
                  </p>
                )}

                {data.quickWinGames?.length > 0 && (
                  <label className="inline-flex items-center gap-2 mt-2 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quickWinOnly}
                      onChange={(e) => setQuickWinOnly(e.target.checked)}
                      className="rounded accent-sky-300"
                    />
                    Only pick quick wins (&le;8h)
                  </label>
                )}
              </div>

              <button
                onClick={spinRoulette}
                className="glossy-btn px-5 py-3 rounded-2xl bg-gradient-to-r from-sky-300 via-indigo-300 to-violet-300 border border-white/50 text-xs font-bold text-slate-950 shadow-lg shadow-indigo-500/20 shrink-0 cursor-pointer"
              >
                🎲 Spin Random Game
              </button>
            </div>
          )}

          {/* Interactive Game Library Explorer */}
          {data.library?.length > 0 && (
            <div className="glossy-panel rounded-3xl p-6 sm:p-8 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-violet-300">
                    Library Explorer
                  </span>
                  <h3 className="text-lg font-bold text-slate-100">
                    Browse Your {data.library.length.toLocaleString()} Games
                  </h3>
                </div>

                <input
                  type="text"
                  placeholder="Search game title..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setVisibleCount(24);
                  }}
                  className="w-full sm:w-64 px-4 py-2.5 rounded-xl bg-slate-950/60 border border-white/12 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-300/60"
                />
              </div>

              {/* Filter Pills & Sort Dropdown */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/10">
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        libraryFilter === tab.id
                          ? 'bg-white/15 text-white border border-white/25'
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
                  className="px-3 py-1.5 rounded-xl bg-slate-950/70 border border-white/15 text-xs text-slate-200 focus:outline-none focus:border-sky-300/60 cursor-pointer"
                >
                  <option value="hours-desc">Sort: Most Played</option>
                  <option value="price-desc">Sort: Highest Price</option>
                  <option value="name-asc">Sort: Name (A–Z)</option>
                </select>
              </div>

              {/* Filtered & Sorted Game Grid */}
              {(() => {
                const filtered = data.library
                  .filter((g) => {
                    if (
                      searchTerm &&
                      !g.name.toLowerCase().includes(searchTerm.toLowerCase())
                    ) {
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
                  <>
                    <div className="text-xs text-slate-400">
                      Showing {shown.length} of {filtered.length.toLocaleString()} matching titles
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {shown.map((game) => (
                        <div
                          key={game.appid}
                          onMouseMove={handleCardMove}
                          className="glossy-card glow-sky rounded-2xl overflow-hidden flex flex-col justify-between"
                        >
                          <div>
                            <div className="relative h-28 w-full bg-slate-900 overflow-hidden">
                              <GameCover
                                appid={game.appid}
                                name={game.name}
                                className="w-full h-full object-cover"
                              />
                              <span
                                className={`absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-semibold backdrop-blur-md border ${
                                  game.minutes === 0
                                    ? 'bg-rose-950/80 border-rose-400/30 text-rose-200'
                                    : 'bg-slate-950/80 border-white/20 text-sky-200'
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
                              <div className="text-xs text-slate-400 mt-1.5">
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
                              className="glossy-btn px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-semibold text-sky-200"
                            >
                              ▶ Launch
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>

                    {visibleCount < filtered.length && (
                      <div className="pt-2 text-center">
                        <button
                          onClick={() => setVisibleCount((prev) => prev + 24)}
                          className="glossy-btn glossy-card glow-violet px-6 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white cursor-pointer"
                        >
                          Load More ({filtered.length - visibleCount} remaining)
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* 1v1 FRIEND BATTLE VIEW */}
      {data && data2 && (
        <div ref={cardRef} className="w-full max-w-4xl glossy-panel rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] font-semibold text-violet-200">
              1v1 LIBRARY SHOWDOWN
            </span>
            <h2 className="text-2xl font-bold text-slate-100 mt-2.5">
              {data.profile.name} <span className="text-slate-500 mx-2 font-normal">vs</span>{' '}
              {data2.profile.name}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[data, data2].map((player, idx) => (
              <div
                key={player.profile.steamId}
                onMouseMove={handleCardMove}
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
                  <span
                    className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-semibold border mt-1 bg-gradient-to-r ${
                      getPersona(player.stats).style
                    }`}
                  >
                    {getPersona(player.stats).label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {[
              {
                label: 'Total Games Owned',
                v1: data.stats.totalGames,
                v2: data2.stats.totalGames,
                fmt: (v) => v.toLocaleString(),
                higherWins: true,
              },
              {
                label: 'Total Hours Played',
                v1: data.stats.totalHours,
                v2: data2.stats.totalHours,
                fmt: (v) => `${v.toLocaleString()}h`,
                higherWins: true,
              },
              {
                label: 'Est. Library Value',
                v1: data.financials.totalRetailValue,
                v2: data2.financials.totalRetailValue,
                fmt: (v, p) => formatCurrency(v, p.financials.currency),
                higherWins: true,
              },
              {
                label: 'Unplayed Shame Value',
                v1: data.financials.unplayedValue,
                v2: data2.financials.unplayedValue,
                fmt: (v, p) => formatCurrency(v, p.financials.currency),
                higherWins: false,
              },
              {
                label: 'Cost Per Hour Efficiency',
                v1: data.financials.costPerHour,
                v2: data2.financials.costPerHour,
                fmt: (v, p) => `${formatCurrency(v, p.financials.currency)}/hr`,
                higherWins: false,
              },
              {
                label: 'Backlog Unplayed %',
                v1: data.stats.unplayedPercentage,
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
                  onMouseMove={handleCardMove}
                  className="glossy-card glow-sky rounded-2xl px-4 py-3.5 grid grid-cols-3 items-center text-center"
                >
                  <div
                    className={`text-base sm:text-lg font-bold ${
                      p1Wins ? 'text-sky-200' : 'text-slate-400'
                    }`}
                  >
                    {row.fmt(row.v1, data)} {p1Wins && '👑'}
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
      )}
    </main>
  );
}

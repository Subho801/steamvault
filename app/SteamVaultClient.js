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
    const pool = data?.unplayedGames || [];
    if (!pool.length) return;
    const random = pool[Math.floor(Math.random() * pool.length)];
    setRouletteGame(random);
  };

  const getPersona = (stats, financials) => {
    const topGameShare =
      stats.totalHours > 0 ? (stats.mostPlayed.hours / stats.totalHours) * 100 : 0;
    const isInr = (financials?.currency || 'INR') === 'INR';
    const goodCph = isInr ? 35 : 0.5;

    if (stats.totalGames >= 2000)
      return {
        label: 'Leviathan Collector',
        desc: 'Owns 2,000+ games — a walking Steam storefront archive.',
        style: 'from-amber-400/25 to-yellow-400/25 border-amber-300/40 text-amber-200',
      };
    if (stats.totalHours >= 300 && topGameShare >= 65)
      return {
        label: 'One-Game Andy',
        desc: `${Math.round(topGameShare)}% of all playtime is spent in ${stats.mostPlayed.name}.`,
        style: 'from-cyan-400/25 to-sky-400/25 border-cyan-300/35 text-cyan-200',
      };
    if (stats.totalHours >= 5000)
      return {
        label: 'Certified No-Lifer',
        desc: '5,000+ hours logged on Steam — practically lives in-game.',
        style: 'from-sky-400/25 to-indigo-400/25 border-sky-300/35 text-sky-200',
      };
    if (stats.unplayedPercentage >= 75 && stats.totalGames >= 100)
      return {
        label: 'Digital Hoarder',
        desc: '75%+ of the library has 0 minutes played.',
        style: 'from-violet-400/25 to-fuchsia-400/25 border-violet-300/35 text-violet-200',
      };
    if (stats.unplayedPercentage >= 55 && stats.totalGames >= 50)
      return {
        label: 'Steam Sale Victim',
        desc: 'Over 55% untouched backlog — couldn’t resist seasonal discounts.',
        style: 'from-amber-400/25 to-rose-400/25 border-amber-300/35 text-amber-200',
      };
    if (
      financials?.costPerHour > 0 &&
      financials.costPerHour <= goodCph &&
      stats.totalHours >= 500
    )
      return {
        label: 'Value Optimizer',
        desc: 'Extracts maximum playtime out of every rupee/dollar spent.',
        style: 'from-emerald-400/25 to-lime-400/25 border-emerald-300/35 text-emerald-200',
      };
    if (stats.totalHours >= 2000 && stats.unplayedPercentage < 55)
      return {
        label: 'Backlog Warrior',
        desc: '2,000+ hours played while keeping the unplayed backlog under control.',
        style: 'from-indigo-400/25 to-blue-400/25 border-indigo-300/35 text-indigo-200',
      };
    if (stats.totalGames >= 50 && stats.unplayedPercentage < 40)
      return {
        label: 'Weekend Explorer',
        desc: 'Actively plays over 60% of the games in their library.',
        style: 'from-teal-400/25 to-emerald-400/25 border-teal-300/35 text-teal-200',
      };
    if (stats.totalGames < 25 && stats.totalHours < 100)
      return {
        label: 'Window Shopper',
        desc: 'Minimalist library — buys only what they immediately play.',
        style: 'from-slate-400/25 to-zinc-400/25 border-slate-300/35 text-slate-200',
      };
    return {
      label: 'Disciplined Gamer',
      desc: 'Healthy balance between library size, playtime, and backlog.',
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
      {/* SteamDB-Style Equipped Profile Background */}
      {data?.profile?.background && (
        <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
          {data.profile.background.type === 'video' ? (
            <video
              src={data.profile.background.url}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover opacity-55 scale-105"
            />
          ) : (
            <img
              src={data.profile.background.url}
              alt=""
              className="w-full h-full object-cover object-top opacity-55"
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 30%, rgba(13, 18, 30, 0.35) 0%, rgba(13, 18, 30, 0.88) 85%)',
            }}
          />
        </div>
      )}

      {/* Top Brand Header */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-8">
        <button
          onClick={resetHome}
          className="flex items-center gap-3 text-left cursor-pointer group"
        >
          <img
            src="/logo.png"
            alt="SteamVault Logo"
            className="w-10 h-10 rounded-2xl object-cover border border-white/25 shadow-lg shadow-sky-400/20 transition-transform duration-300 group-hover:scale-105"
          />
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
              ? 'A calm, clear look at your library value, unplayed backlog hours, and gamer persona.'
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
      {data && !data2 && (() => {
        const persona = getPersona(data.stats, data.financials);
        const avgGamePrice =
          data.stats.totalGames > 0
            ? Math.round(data.financials.totalRetailValue / data.stats.totalGames)
            : 0;
        const playedGamesCount = Math.max(0, data.stats.totalGames - data.stats.neverPlayed);
        const playedPercentage = Math.max(0, 100 - data.stats.unplayedPercentage);
        const topGamePct =
          data.stats.totalHours > 0
            ? Math.round((data.stats.mostPlayed.hours / data.stats.totalHours) * 100)
            : 0;

        return (
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
                        title={persona.desc}
                        className={`text-[11px] px-3 py-0.5 rounded-full font-semibold border bg-gradient-to-r backdrop-blur-md cursor-help ${persona.style}`}
                      >
                        {persona.label}
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
                    <p className="text-[11px] text-slate-400/90 mt-1 italic">{persona.desc}</p>
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
                    <span className="text-xs text-emerald-200/85">Avg. Game Price</span>
                    <div className="text-2xl font-bold text-emerald-300 mt-1">
                      {formatCurrency(avgGamePrice, data.financials.currency)}
                      <span className="text-sm font-normal text-emerald-200/70">/game</span>
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
                  Backlog &amp; Playtime Breakdown
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
                    className="glossy-card glow-emerald rounded-2xl p-5"
                  >
                    <span className="text-xs text-slate-400">Games Played</span>
                    <div className="text-2xl font-bold text-emerald-200 mt-1">
                      {playedGamesCount}
                    </div>
                    <div className="w-full bg-slate-900/80 h-1.5 rounded-full mt-2.5 overflow-hidden border border-white/10">
                      <div
                        className="bg-gradient-to-r from-emerald-300 to-teal-300 h-full rounded-full transition-all duration-700"
                        style={{ width: `${playedPercentage}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1.5 block">
                      {playedPercentage}% of library explored
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
                </div>
              </div>

              {/* Glossy Highlight Pills */}
              <div className="flex flex-wrap gap-2.5 pt-1">
                {topGamePct > 0 && (
                  <span
                    onMouseMove={handleCardMove}
                    className="glossy-card glow-sky px-3.5 py-1.5 rounded-full text-xs text-sky-200"
                  >
                    👑 Top game share: <strong>{topGamePct}%</strong> of all playtime
                  </span>
                )}

                <span
                  onMouseMove={handleCardMove}
                  className="glossy-card glow-emerald px-3.5 py-1.5 rounded-full text-xs text-emerald-200"
                >
                  🔥 Recent pace: <strong>{data.backlogTime.hoursPerTwoWeeks}h</strong> / 2 weeks
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
                </div>

                <button
                  onClick={spinRoulette}
                  className="glossy-btn px-5 py-3 rounded-2xl bg-gradient-to-r from-sky-300 via-indigo-300 to-violet-300 border border-white/50 text-xs font-bold text-slate-950 shadow-lg shadow-indigo-500/20 shrink-0 cursor-pointer"
                >
                  🎲 Spin Random Game
                </button>
              </div>
            )}

            {/* Link to Dedicated Library Explorer Page */}
            {data.library?.length > 0 && (
              <div className="glossy-panel rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-violet-300">
                    Full Library Explorer
                  </span>
                  <h3 className="text-base font-bold text-slate-100 mt-0.5">
                    Browse &amp; Search All {data.library.length.toLocaleString()} Games
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Filter by unplayed, sort by price or hours, and launch titles on a dedicated page.
                  </p>
                </div>

                <a
                  href={`/u/${encodeURIComponent(query || data.profile.steamId)}/library`}
                  className="glossy-btn px-5 py-3 rounded-2xl bg-gradient-to-r from-violet-300 via-indigo-300 to-sky-300 border border-white/50 text-xs font-bold text-slate-950 shadow-lg shadow-indigo-500/20 shrink-0"
                >
                  Open Library ({data.library.length.toLocaleString()}) →
                </a>
              </div>
            )}
          </div>
        );
      })()}

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
            {[data, data2].map((player, idx) => {
              const pBadge = getPersona(player.stats, player.financials);
              return (
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
                      title={pBadge.desc}
                      className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-semibold border mt-1 bg-gradient-to-r ${pBadge.style}`}
                    >
                      {pBadge.label}
                    </span>
                  </div>
                </div>
              );
            })}
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

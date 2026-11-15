import Link from 'next/link';

const PERSONAS = [
  {
    title: 'Leviathan Collector',
    rule: 'Owns 2,000+ Steam games',
    desc: 'A walking storefront archive. At this point you aren’t playing Steam—you’re curating a digital museum.',
    style: 'from-amber-400/25 to-yellow-400/25 border-amber-300/40 text-amber-200',
  },
  {
    title: 'One-Game Andy',
    rule: '65%+ of total playtime in a single title (300h+)',
    desc: 'Buys dozens of games during sales just to launch the exact same comfort game every single night.',
    style: 'from-cyan-400/25 to-sky-400/25 border-cyan-300/35 text-cyan-200',
  },
  {
    title: 'Certified No-Lifer',
    rule: '5,000+ total hours on record',
    desc: 'Over 200 full days and nights spent in-game. Grass is merely a texture pack.',
    style: 'from-sky-400/25 to-indigo-400/25 border-sky-300/35 text-sky-200',
  },
  {
    title: 'Digital Hoarder',
    rule: '75%+ unplayed games (with 100+ owned)',
    desc: 'Three out of every four games have 0 minutes played. Buys games faster than human lifespan allows.',
    style: 'from-violet-400/25 to-fuchsia-400/25 border-violet-300/35 text-violet-200',
  },
  {
    title: 'Steam Sale Victim',
    rule: '55%+ unplayed games (with 50+ owned)',
    desc: 'Couldn’t resist that 85%-off seasonal banner. Over half the library sits shrink-wrapped.',
    style: 'from-amber-400/25 to-rose-400/25 border-amber-300/35 text-amber-200',
  },
  {
    title: 'Value Optimizer',
    rule: 'Ultra-low cost per hour (500h+ played)',
    desc: 'Extracts maximum entertainment value out of every rupee or dollar spent.',
    style: 'from-emerald-400/25 to-lime-400/25 border-emerald-300/35 text-emerald-200',
  },
  {
    title: 'Backlog Warrior',
    rule: '2,000+ hours played & under 55% unplayed',
    desc: 'Heavy gamer who actually installs and finishes the games they purchase.',
    style: 'from-indigo-400/25 to-blue-400/25 border-indigo-300/35 text-indigo-200',
  },
  {
    title: 'Weekend Explorer',
    rule: '50+ games owned & under 40% unplayed',
    desc: 'Samples over 60% of their library instead of letting titles gather dust.',
    style: 'from-teal-400/25 to-emerald-400/25 border-teal-300/35 text-teal-200',
  },
  {
    title: 'Window Shopper',
    rule: 'Under 25 games & under 100 hours',
    desc: 'Minimalist account—either brand new to PC gaming or strictly free-to-play.',
    style: 'from-slate-400/25 to-zinc-400/25 border-slate-300/35 text-slate-200',
  },
  {
    title: 'Disciplined Gamer',
    rule: 'Balanced library & playtime ratio',
    desc: 'Healthy equilibrium between buying new releases and actually playing them.',
    style: 'from-emerald-400/25 to-teal-400/25 border-emerald-300/35 text-emerald-200',
  },
];

export default function BadgesGuidePage() {
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
            className="px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
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
            className="px-3.5 py-2 rounded-xl bg-white/15 text-white border border-white/25"
          >
            Badges
          </Link>
        </nav>
      </div>

      <div className="w-full max-w-4xl glossy-panel rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="pb-4 border-b border-white/12">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-300">
            Persona Tier List
          </span>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">
            All 10 SteamVault Gamer Personas
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Evaluated in priority order from top to bottom whenever your profile is scanned.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PERSONAS.map((p, idx) => (
            <div key={p.title} className="glossy-card glow-sky rounded-2xl p-5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs px-3 py-1 rounded-full font-bold border bg-gradient-to-r ${p.style}`}
                >
                  {p.title}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">Tier #{idx + 1}</span>
              </div>
              <div className="text-xs font-semibold text-sky-200">{p.rule}</div>
              <p className="text-xs text-slate-400 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

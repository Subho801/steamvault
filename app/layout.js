import './globals.css';

export const metadata = {
  title: 'SteamVault — Library Value, Backlog & Battle Analytics',
  description: 'Check your Steam account value, unplayed backlog hours, cost per hour, and compare stats against friends.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
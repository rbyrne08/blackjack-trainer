import { useState } from 'react';
import { GameTable } from './components/table/GameTable';
import { SettingsPage } from './components/settings/SettingsPage';
import { StatsPage } from './components/stats/StatsPage';
import { fmtMoney } from './lib/format';
import { useGameStore } from './store/gameStore';

type Tab = 'play' | 'stats' | 'settings';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'play', label: 'Play' },
  { id: 'stats', label: 'Stats' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('play');
  const bankroll = useGameStore((s) => s.game.bankroll);

  return (
    <>
      <header className="app-header">
        <h1 className="app-title">
          <span className="suit">♠</span>Blackjack Trainer
        </h1>
        <nav className="nav-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="bankroll-pill">
          <span className="label">Bankroll</span>
          <span className="value">{fmtMoney(bankroll)}</span>
        </div>
      </header>
      <main>
        {tab === 'play' && <GameTable />}
        {tab === 'stats' && <StatsPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
    </>
  );
}

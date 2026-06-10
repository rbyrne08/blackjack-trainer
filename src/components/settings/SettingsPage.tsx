import { clearAll } from '../../store/persistence';
import { useSettingsStore } from '../../store/settingsStore';
import { useStatsStore } from '../../store/statsStore';
import { Segmented, SettingRow, Toggle } from '../shared/controls';

export function SettingsPage() {
  const rules = useSettingsStore((s) => s.rules);
  const prefs = useSettingsStore((s) => s.prefs);
  const setRules = useSettingsStore((s) => s.setRules);
  const setPrefs = useSettingsStore((s) => s.setPrefs);
  const resetSettings = useSettingsStore((s) => s.resetSettings);
  const resetStats = useStatsStore((s) => s.resetAll);

  return (
    <div className="page">
      <div className="panel">
        <h2>Game rules</h2>
        <p className="panel-sub">
          Strategy feedback and EVs recompute for the exact rule set. Changing a rule starts a
          fresh shoe.
        </p>

        <SettingRow name="Decks in shoe" hint="Fewer decks favor the player and shift several plays.">
          <Segmented
            options={([1, 2, 3, 4, 5, 6, 7, 8] as const).map((d) => ({ value: d, label: String(d) }))}
            value={rules.decks}
            onChange={(decks) => setRules({ decks })}
          />
        </SettingRow>

        <SettingRow name="Dealer soft 17" hint="H17 (dealer hits) raises the house edge ~0.2% and changes several plays.">
          <Segmented
            options={[
              { value: false, label: 'Stands (S17)' },
              { value: true, label: 'Hits (H17)' },
            ]}
            value={rules.dealerHitsSoft17}
            onChange={(v) => setRules({ dealerHitsSoft17: v })}
          />
        </SettingRow>

        <SettingRow name="Double after split" hint="DAS makes several pair splits correct (2,2 / 3,3 vs 2-3, 4,4 vs 5-6).">
          <Toggle on={rules.doubleAfterSplit} onChange={(v) => setRules({ doubleAfterSplit: v })} />
        </SettingRow>

        <SettingRow
          name="Late surrender"
          hint={rules.dealerPeeks ? 'Give up half the bet as your first action (15/16 vs strong upcards).' : 'Unavailable in no-hole-card games.'}
        >
          <Toggle
            on={rules.lateSurrender}
            onChange={(v) => setRules({ lateSurrender: v })}
          />
        </SettingRow>

        <SettingRow name="Blackjack pays" hint="6:5 adds ~1.4% to the house edge — the single worst common rule.">
          <Segmented
            options={[
              { value: 1.5, label: '3:2' },
              { value: 1.2, label: '6:5' },
            ]}
            value={rules.blackjackPayout}
            onChange={(v) => setRules({ blackjackPayout: v })}
          />
        </SettingRow>

        <SettingRow name="Double on" hint="Reno-style restrictions kill soft doubling entirely.">
          <Segmented
            options={[
              { value: 'any2', label: 'Any two cards' },
              { value: '9-11', label: '9–11 only' },
              { value: '10-11', label: '10–11 only' },
            ]}
            value={rules.doubleRestriction}
            onChange={(v) => setRules({ doubleRestriction: v })}
          />
        </SettingRow>

        <SettingRow name="Split up to" hint="Maximum total hands after resplitting.">
          <Segmented
            options={[
              { value: 2, label: '2 hands' },
              { value: 3, label: '3 hands' },
              { value: 4, label: '4 hands' },
            ]}
            value={rules.maxSplitHands}
            onChange={(v) => setRules({ maxSplitHands: v })}
          />
        </SettingRow>

        <SettingRow name="Hole card" hint="ENHC (European): no peek — a dealer natural takes doubles and splits too, so 11 vs T no longer doubles.">
          <Segmented
            options={[
              { value: true, label: 'American (peek)' },
              { value: false, label: 'European (ENHC)' },
            ]}
            value={rules.dealerPeeks}
            onChange={(v) => setRules({ dealerPeeks: v })}
          />
        </SettingRow>

        <SettingRow name="Penetration" hint="How deep the shoe is dealt before a shuffle. Deeper = bigger true-count swings = more deviation practice.">
          <span>
            <input
              type="range"
              min={50}
              max={90}
              step={5}
              value={rules.penetrationPct}
              onChange={(e) => setRules({ penetrationPct: Number(e.target.value) })}
            />
            <span className="range-val">{rules.penetrationPct}%</span>
          </span>
        </SettingRow>
      </div>

      <div className="panel">
        <h2>Training</h2>
        <p className="panel-sub">How much help you want while you play.</p>

        <SettingRow
          name="Show action EVs before deciding"
          hint="Displays the expected value of every available action — it spoils the answer, on purpose."
        >
          <Toggle on={prefs.showEvPanel} onChange={(v) => setPrefs({ showEvPanel: v })} />
        </SettingRow>
      </div>

      <div className="panel">
        <h2>Card counting</h2>
        <p className="panel-sub">
          Hi-Lo: 2–6 count +1, 7–9 count 0, tens and aces count −1. True count = running count ÷
          decks remaining.
        </p>

        <SettingRow
          name="Counting mode"
          hint="Tracks the count, quizzes you on it, grades Illustrious 18 / Fab 4 index plays, and advises bet sizing."
        >
          <Toggle on={prefs.countingMode} onChange={(v) => setPrefs({ countingMode: v })} />
        </SettingRow>

        <SettingRow
          name="Count display"
          hint="Training wheels show the live RC/TC; test mode hides them so quizzes are the only feedback."
        >
          <Segmented
            options={[
              { value: 'visible', label: 'Visible' },
              { value: 'hidden', label: 'Hidden (test me)' },
            ]}
            value={prefs.countVisibility}
            onChange={(v) => setPrefs({ countVisibility: v })}
          />
        </SettingRow>

        <SettingRow
          name="Quiz every"
          hint="When on, a count check also fires before each shuffle. Off = no quizzes; use 'Check my count' to self-test anytime."
        >
          <Segmented
            options={[
              { value: 0, label: 'Off' },
              ...[2, 3, 4, 6, 8].map((n) => ({ value: n, label: `${n} rounds` })),
            ]}
            value={prefs.quizEveryNRounds}
            onChange={(v) => setPrefs({ quizEveryNRounds: v })}
          />
        </SettingRow>

        <SettingRow name="Betting unit" hint="Bet advice = ramp units × this amount (1-2-4-8-12 spread).">
          <Segmented
            options={[5, 10, 25, 50].map((n) => ({ value: n, label: `$${n}` }))}
            value={prefs.betUnit}
            onChange={(v) => setPrefs({ betUnit: v })}
          />
        </SettingRow>
      </div>

      <div className="panel">
        <h2>Data</h2>
        <p className="panel-sub">Settings and history live in this browser's local storage.</p>
        <SettingRow name="Reset everything" hint="Clears all history, stats, and settings.">
          <button
            className="btn danger"
            onClick={() => {
              if (window.confirm('Delete all saved history, stats, and settings?')) {
                resetStats();
                resetSettings();
                clearAll();
              }
            }}
          >
            Reset all data
          </button>
        </SettingRow>
      </div>
    </div>
  );
}

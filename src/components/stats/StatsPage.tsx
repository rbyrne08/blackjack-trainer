import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { actionLabel, cellLabel, fmtMoney, fmtPct } from '../../lib/format';
import { allSessions, useStatsStore } from '../../store/statsStore';

export function StatsPage() {
  const lifetime = useStatsStore((s) => s.lifetime);
  const decisions = useStatsStore((s) => s.decisions);
  const pastSessions = useStatsStore((s) => s.sessions);
  const current = useStatsStore((s) => s.current);
  const sessions = useMemo(
    () => allSessions({ sessions: pastSessions, current }),
    [pastSessions, current],
  );

  const chartData = sessions
    .filter((s) => s.decisions > 0)
    .slice(-30)
    .map((s, i) => ({
      name: `#${i + 1}`,
      accuracy: Math.round((s.correct / s.decisions) * 1000) / 10,
      evPer100: Math.round((s.evLost / s.decisions) * 1000) / 10,
    }));

  const missed = Object.entries(lifetime.cells)
    .filter(([, c]) => c.wrong > 0)
    .sort((a, b) => b[1].evLost - a[1].evLost)
    .slice(0, 10);

  const recent = decisions.slice(-12).reverse();

  return (
    <div className="page">
      <div className="stat-cards">
        <div className="stat-card">
          <div className="k">Strategy accuracy</div>
          <div className="v">
            {lifetime.decisions > 0 ? fmtPct(lifetime.correct / lifetime.decisions) : '—'}
          </div>
          <div className="sub">{lifetime.decisions.toLocaleString()} decisions</div>
        </div>
        <div className="stat-card">
          <div className="k">EV lost / 100 decisions</div>
          <div className="v">
            {lifetime.decisions > 0
              ? `${((lifetime.evLost / lifetime.decisions) * 100).toFixed(1)} bets`
              : '—'}
          </div>
          <div className="sub">cost of basic-strategy mistakes</div>
        </div>
        <div className="stat-card">
          <div className="k">Hands played</div>
          <div className="v">{lifetime.hands.toLocaleString()}</div>
          <div className="sub">{sessions.length} session{sessions.length === 1 ? '' : 's'}</div>
        </div>
        <div className="stat-card">
          <div className="k">Net result</div>
          <div className={`v ${lifetime.bankrollNet > 0 ? 'pos' : lifetime.bankrollNet < 0 ? 'neg' : ''}`}>
            {fmtMoney(lifetime.bankrollNet)}
          </div>
          <div className="sub">variance is loud; accuracy is the signal</div>
        </div>
        <div className="stat-card">
          <div className="k">Count quizzes</div>
          <div className="v">
            {lifetime.quizAsked > 0 ? fmtPct(lifetime.quizCorrect / lifetime.quizAsked) : '—'}
          </div>
          <div className="sub">
            {lifetime.quizAsked > 0
              ? `mean error ${(lifetime.quizAbsErrorSum / lifetime.quizAsked).toFixed(2)} over ${lifetime.quizAsked}`
              : 'enable counting mode to practice'}
          </div>
        </div>
        <div className="stat-card">
          <div className="k">Index plays missed</div>
          <div className="v">{lifetime.deviationMisses.toLocaleString()}</div>
          <div className="sub">Illustrious 18 / Fab 4 deviations</div>
        </div>
        <div className="stat-card">
          <div className="k">Insurance accuracy</div>
          <div className="v">
            {lifetime.insuranceDecisions > 0
              ? fmtPct(lifetime.insuranceCorrect / lifetime.insuranceDecisions)
              : '—'}
          </div>
          <div className="sub">{lifetime.insuranceDecisions} decisions</div>
        </div>
      </div>

      <div className="panel">
        <h2>Accuracy by session</h2>
        <p className="panel-sub">Strategy accuracy % and EV lost per 100 decisions, last 30 sessions.</p>
        {chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
              <XAxis dataKey="name" stroke="#6d8577" fontSize={12} tickLine={false} />
              <YAxis stroke="#6d8577" fontSize={12} tickLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  background: '#0e2f1f',
                  border: '1px solid rgba(255,255,255,0.16)',
                  borderRadius: 10,
                  color: '#f3ecdb',
                }}
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                name="Accuracy %"
                stroke="#d9b45b"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="evPer100"
                name="EV lost / 100"
                stroke="#e2604e"
                strokeWidth={1.8}
                dot={{ r: 2.5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-note">Play across a couple of sessions to see the trend.</div>
        )}
      </div>

      <div className="panel">
        <h2>Most expensive habits</h2>
        <p className="panel-sub">The spots where your mistakes have cost the most, lifetime.</p>
        {missed.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Hand</th>
                <th className="num">Seen</th>
                <th className="num">Wrong</th>
                <th className="num">Miss rate</th>
                <th className="num">EV lost (bets)</th>
              </tr>
            </thead>
            <tbody>
              {missed.map(([cellKey, c]) => (
                <tr key={cellKey}>
                  <td>{cellLabel(cellKey)}</td>
                  <td className="num">{c.seen}</td>
                  <td className="num bad-text">{c.wrong}</td>
                  <td className="num">{fmtPct(c.wrong / c.seen)}</td>
                  <td className="num">{c.evLost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-note">No mistakes recorded yet. Either you're perfect or you haven't played.</div>
        )}
      </div>

      <div className="panel">
        <h2>Recent decisions</h2>
        <p className="panel-sub">Your last few graded plays.</p>
        {recent.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Hand</th>
                <th>You played</th>
                <th>Optimal</th>
                <th className="num">Cost</th>
                <th className="num">TC</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((d) => (
                <tr key={d.t + d.cellKey}>
                  <td>{cellLabel(d.cellKey)}</td>
                  <td className={d.correct ? 'good-text' : 'bad-text'}>
                    {actionLabel(d.chosen)} {d.correct ? '✓' : '✗'}
                  </td>
                  <td>
                    {actionLabel(d.optimal)}
                    {d.deviationId ? ' (index)' : ''}
                  </td>
                  <td className="num">{d.evCost > 0 ? d.evCost.toFixed(3) : '—'}</td>
                  <td className="num">{d.tc !== null ? d.tc.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-note">Deal a few hands and your decisions will show up here.</div>
        )}
      </div>
    </div>
  );
}

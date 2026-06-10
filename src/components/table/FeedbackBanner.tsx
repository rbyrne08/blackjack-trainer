import type { GradedDecision, GradedInsurance } from '../../engine/grading';
import { actionLabel, fmtEv, fmtTc } from '../../lib/format';

export function FeedbackBanner({
  grade,
  insurance,
}: {
  grade: GradedDecision | null;
  insurance: GradedInsurance | null;
}) {
  // The action grade supersedes the insurance grade once play continues.
  if (grade) {
    return (
      <div className="feedback-slot">
        <div className={`feedback ${grade.isCorrect ? 'good' : 'bad'}`}>
          {grade.isCorrect ? (
            <div className="headline">✓ {actionLabel(grade.chosen)} was correct</div>
          ) : (
            <div className="headline">
              ✗ You chose {actionLabel(grade.chosen)} — optimal was {actionLabel(grade.optimal)}
            </div>
          )}
          {!grade.isCorrect && grade.evCost > 0 && (
            <div className="detail">
              Cost ≈ {grade.evCost.toFixed(3)} bets (EV {fmtEv(grade.evChosen)} vs{' '}
              {fmtEv(grade.evOptimal)})
            </div>
          )}
          {grade.deviation && (
            <div className="deviation-note">
              Index play: {grade.deviation.label}
              {grade.trueCount !== null && <> — you were at TC {fmtTc(grade.trueCount)}</>}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (insurance) {
    return (
      <div className="feedback-slot">
        <div className={`feedback ${insurance.isCorrect ? 'good' : 'bad'}`}>
          <div className="headline">
            {insurance.isCorrect ? '✓' : '✗'} Insurance:{' '}
            {insurance.took ? 'taken' : 'declined'} —{' '}
            {insurance.optimalTake ? 'correct play is to take it' : 'correct play is to decline'}
          </div>
          <div className="detail">
            {insurance.trueCount === null
              ? `Insurance is a losing side bet off the top (EV ${fmtEv(insurance.insuranceEv)} per unit).`
              : insurance.optimalTake
                ? `TC ${fmtTc(insurance.trueCount)} ≥ +3: the shoe is ten-rich enough to insure.`
                : `Take insurance only at TC ≥ +3 (you were at ${fmtTc(insurance.trueCount)}).`}
          </div>
        </div>
      </div>
    );
  }

  return <div className="feedback-slot" />;
}

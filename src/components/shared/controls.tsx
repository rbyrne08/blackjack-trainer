interface SegmentedOption<T> {
  value: T;
  label: string;
}

export function Segmented<T extends string | number | boolean>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          className={opt.value === value ? 'on' : ''}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
    />
  );
}

export function SettingRow({
  name,
  hint,
  children,
}: {
  name: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-label">
        <div className="name">{name}</div>
        {hint && <div className="hint">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

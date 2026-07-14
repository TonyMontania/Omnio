interface DisplayProps {
  value: number
  max?: number
}

interface InputProps extends DisplayProps {
  onChange: (v: number) => void
}

function StarUnit({ fillPct }: { fillPct: number }) {
  return (
    <span className="star-unit">
      <span className="star-bg">★</span>
      <span className="star-fg" style={{ width: `${fillPct}%` }}>★</span>
    </span>
  )
}

export function StarRatingDisplay({ value, max = 5 }: DisplayProps) {
  return (
    <span className="star-row">
      {Array.from({ length: max }, (_, i) => {
        const diff = value - i
        const pct = diff >= 1 ? 100 : diff >= 0.5 ? 50 : 0
        return <StarUnit key={i} fillPct={pct} />
      })}
    </span>
  )
}

export function StarRatingInput({ value, onChange, max = 5 }: InputProps) {
  return (
    <span className="star-row interactive">
      {Array.from({ length: max }, (_, i) => {
        const diff = value - i
        const pct = diff >= 1 ? 100 : diff >= 0.5 ? 50 : 0
        return (
          <span key={i} className="star-unit">
            <StarUnit fillPct={pct} />
            <button type="button" className="star-half-btn left" onClick={() => onChange(value === i + 0.5 ? 0 : i + 0.5)} />
            <button type="button" className="star-half-btn right" onClick={() => onChange(value === i + 1 ? 0 : i + 1)} />
          </span>
        )
      })}
    </span>
  )
}
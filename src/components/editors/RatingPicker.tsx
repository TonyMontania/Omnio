// 0-5 rating in half-star steps rendered as a row of 10 numeric pills.
// Clicking the current value resets to 0.

export default function RatingPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const steps = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.5)
  return (
    <div className="rating-picker">
      {steps.map((n) => (
        <button key={n} type="button" className={n <= value ? 'rating-dot filled' : 'rating-dot'} onClick={() => onChange(value === n ? 0 : n)}>{n}</button>
      ))}
    </div>
  )
}

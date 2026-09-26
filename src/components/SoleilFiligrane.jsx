/** Soleil XGS en filigrane, repris du portail : décor des fonds bleu nuit. */
export default function SoleilFiligrane() {
  const rayons = Array.from({ length: 12 }, (_, i) => i * 30)
  return (
    <svg className="filigrane" viewBox="0 0 200 200" aria-hidden="true">
      <g fill="none" stroke="var(--gold)" strokeLinecap="round">
        <circle cx="100" cy="100" r="38" strokeWidth="5" />
        {rayons.map((a) => (
          <line key={a} x1="100" y1={a % 60 === 0 ? 34 : 40} x2="100" y2={a % 60 === 0 ? 14 : 24} strokeWidth="6" transform={`rotate(${a} 100 100)`} />
        ))}
        <path d="M84 96 q5 -6 10 0" strokeWidth="4" />
        <path d="M106 94 q5 -6 10 0" strokeWidth="4" />
        <path d="M88 112 q12 10 24 0" strokeWidth="4" />
      </g>
    </svg>
  )
}

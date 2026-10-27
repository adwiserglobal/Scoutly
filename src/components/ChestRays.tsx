const SPARKLES = [
  { top: '8%', left: '22%', delay: '0s' },
  { top: '18%', left: '80%', delay: '0.5s' },
  { top: '72%', left: '10%', delay: '1.1s' },
  { top: '80%', left: '84%', delay: '1.6s' },
  { top: '2%', left: '56%', delay: '0.9s' },
];

/** Game-style light behind the chest: two counter-rotating ray fans, a pulsing glow and sparkles. */
export default function ChestRays({ intense = false }: { intense?: boolean }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute inset-0 ${intense ? '' : 'opacity-80'}`}>
      <span className="chest-rays" />
      <span className="chest-rays-slow" />
      <span className="chest-glow" />
      {SPARKLES.map((sparkle, index) => (
        <span key={index} className="chest-sparkle" style={{ top: sparkle.top, left: sparkle.left, animationDelay: sparkle.delay }} />
      ))}
    </span>
  );
}

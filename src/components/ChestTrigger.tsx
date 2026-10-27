import ChestRays from './ChestRays';

interface ChestTriggerProps {
  open: boolean;
  remaining: number | null;
  onToggle: () => void;
}

export default function ChestTrigger({ open, remaining, onToggle }: ChestTriggerProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={open}
      aria-label="Baú de oportunidades do dia"
      title="Baú de oportunidades do dia"
      className="group pointer-events-auto relative flex h-[60px] w-[60px] items-center justify-center rounded-full transition active:scale-95"
    >
      <span className="absolute -inset-3">
        <ChestRays />
      </span>
      <img
        src={open ? '/chest-open.png' : '/chest-closed.png'}
        alt=""
        width={56}
        height={56}
        draggable={false}
        className="chest-img relative h-[56px] w-[56px] object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)] transition-transform group-hover:scale-110"
      />
      {remaining !== null && remaining > 0 && !open && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF5A12] px-1 text-[10px] font-extrabold text-white shadow-[0_2px_8px_rgba(255,90,18,0.6)]">
          {remaining}
        </span>
      )}
    </button>
  );
}

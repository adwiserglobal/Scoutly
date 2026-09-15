interface LoadingScreenProps {
  message?: string;
  subtext?: string;
  isOverlay?: boolean;
}

export default function LoadingScreen({
  message = 'Carregando...',
  subtext,
  isOverlay = false,
}: LoadingScreenProps) {
  if (isOverlay) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FFF8F3]/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
        <div className="flex flex-col items-center justify-center text-center max-w-sm">
          <img
            src="/scoutly-loading.gif"
            alt="Scoutly"
            className="w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-sm"
          />
          <div className="flex items-center justify-center gap-2.5 mt-3">
            <div className="w-4 h-4 border-2 border-[#FF4D00] border-t-transparent rounded-full animate-spin shrink-0"></div>
            <span className="text-xs font-bold uppercase tracking-wider text-stone-900">
              {message}
            </span>
          </div>
          {subtext && (
            <p className="text-[11px] text-stone-500 font-medium mt-1">
              {subtext}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-b from-[#FFF8F3] via-[#FAF3EC] to-[#FAF7F2] p-6 text-center select-none">
      <div className="flex flex-col items-center justify-center max-w-md animate-in fade-in zoom-in-95 duration-300">
        {/* Logo / GIF centralizado com fundo branco-alaranjado */}
        <div className="relative flex items-center justify-center">
          <img
            src="/scoutly-loading.gif"
            alt="Scoutly"
            className="w-36 h-36 sm:w-48 sm:h-48 object-contain drop-shadow-md"
          />
        </div>

        <div className="flex items-center justify-center gap-2.5 mt-4">
          <div className="w-4 h-4 border-2 border-[#FF4D00] border-t-transparent rounded-full animate-spin shrink-0"></div>
          <span className="text-xs font-bold uppercase tracking-widest text-stone-900">
            {message}
          </span>
        </div>

        {subtext && (
          <p className="text-xs text-stone-500 font-medium mt-2 max-w-xs">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

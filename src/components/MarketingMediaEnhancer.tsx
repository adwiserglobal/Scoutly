import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';

const VIDEO_URL =
  'https://cdn.openart.ai/openart-uploads/production/attachment-transfers/1ba4952b23e445a52cb8ae04bc79209405e435925229841b4c20fb8165bccf03.mp4';

function OverviewVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video || failed) return;

    if (video.paused) {
      try {
        await video.play();
      } catch {
        setPlaying(false);
      }
    } else {
      video.pause();
    }
  };

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video || failed) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
  };

  return (
    <div className="site-product-video-layer" onContextMenu={(event) => event.preventDefault()}>
      {failed ? (
        <div className="site-video-status">Não foi possível carregar o vídeo.</div>
      ) : (
        <>
          <video
            ref={videoRef}
            src={VIDEO_URL}
            className="site-product-video"
            playsInline
            preload="auto"
            muted={muted}
            disablePictureInPicture
            controlsList="nodownload noplaybackrate nofullscreen"
            onClick={togglePlayback}
            onLoadedData={() => setFailed(false)}
            onError={() => setFailed(true)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            aria-label="Visão geral da plataforma Scoutly"
          />

          <div className="site-video-controls" aria-label="Controles do vídeo">
            <button
              type="button"
              className="site-video-control"
              onClick={togglePlayback}
              aria-label={playing ? 'Pausar vídeo' : 'Reproduzir vídeo'}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className="site-video-control"
              onClick={toggleSound}
              aria-label={muted ? 'Ativar som' : 'Silenciar vídeo'}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function MarketingMediaEnhancer() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const findTarget = () => {
      const image = document.querySelector<HTMLImageElement>('.site-product-image');
      const nextTarget = image?.parentElement ?? null;
      setTarget((current) => (current === nextTarget ? current : nextTarget));
    };

    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  if (!target) return null;
  return createPortal(<OverviewVideo />, target);
}

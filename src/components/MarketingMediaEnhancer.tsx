import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';

const VIDEO_CHUNKS = [
  '/media/scoutly-overview/chunk-00.bin',
  '/media/scoutly-overview/chunk-01.bin',
  '/media/scoutly-overview/chunk-02.bin',
];

function OverviewVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState('');
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';

    const loadVideo = async () => {
      try {
        const responses = await Promise.all(VIDEO_CHUNKS.map((path) => fetch(path)));
        if (responses.some((response) => !response.ok)) {
          throw new Error('Unable to load Scoutly overview video');
        }

        const buffers = await Promise.all(responses.map((response) => response.arrayBuffer()));
        if (cancelled) return;

        objectUrl = URL.createObjectURL(new Blob(buffers, { type: 'video/mp4' }));
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    void loadVideo();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video || !src) return;

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
    if (!video) return;
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
            src={src || undefined}
            className="site-product-video"
            playsInline
            preload="metadata"
            muted={muted}
            disablePictureInPicture
            controlsList="nodownload noplaybackrate nofullscreen"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            aria-label="Visão geral da plataforma Scoutly"
          />

          {!src && <div className="site-video-status">Carregando vídeo</div>}

          <div className="site-video-controls" aria-label="Controles do vídeo">
            <button
              type="button"
              className="site-video-control"
              onClick={togglePlayback}
              disabled={!src}
              aria-label={playing ? 'Pausar vídeo' : 'Reproduzir vídeo'}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className="site-video-control"
              onClick={toggleSound}
              disabled={!src}
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

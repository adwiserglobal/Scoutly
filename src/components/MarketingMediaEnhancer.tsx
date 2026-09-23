import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';

const VIDEO_URL =
  'https://cdn.openart.ai/openart-uploads/production/attachment-transfers/1ba4952b23e445a52cb8ae04bc79209405e435925229841b4c20fb8165bccf03.mp4';

function OverviewVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasAutoPlayedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const startMuted = async () => {
      if (hasAutoPlayedRef.current) return;
      hasAutoPlayedRef.current = true;
      video.muted = true;
      setMuted(true);

      try {
        await video.play();
      } catch {
        setPlaying(false);
      }
    };

    if (!('IntersectionObserver' in window)) {
      void startMuted();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.28) {
          void startMuted();
          observer.disconnect();
        }
      },
      { threshold: [0.28, 0.45, 0.7] }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

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
        <div className="site-video-status">Unable to load the video.</div>
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
            aria-label="Scoutly platform overview"
          />

          <div className="site-video-controls" aria-label="Video controls">
            <button
              type="button"
              className="site-video-control"
              onClick={togglePlayback}
              aria-label={playing ? 'Pause video' : 'Play video'}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className="site-video-control"
              onClick={toggleSound}
              aria-label={muted ? 'Turn sound on' : 'Mute video'}
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

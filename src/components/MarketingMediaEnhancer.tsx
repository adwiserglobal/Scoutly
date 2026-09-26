import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';

const VIDEO_URL_EN =
  'https://cdn.openart.ai/openart-uploads/production/attachment-transfers/1ba4952b23e445a52cb8ae04bc79209405e435925229841b4c20fb8165bccf03.mp4';
const VIDEO_URL_PT =
  'https://cdn.openart.ai/openart-uploads/production/attachment-transfers/1da8309837a368784dc99a7145a47b20bd0d9f133236fb0bb2d8cd03666c6d5e.mp4';

const COPY_REPLACEMENTS: Array<[string, string]> = [
  ['Start free for 7 days', 'Start free'],
  ['7-day Pro trial', 'Free plan · 5 credits/day'],
  ['No card required during trial', 'Up to 25 free credits/month'],
  [
    'Every new user starts with Pro access for 7 days. After that, choose the plan that fits your operating rhythm.',
    'Every new user starts on Free with 5 credits per day, up to 25 per month. Upgrade whenever you need more capacity, AI and advanced features.',
  ],
  ['Up to 80 analyses per month', '80 prospecting credits per month'],
  ['Up to null AI messages per month', '10 Scoutly AI conversations per day'],
  ['Começar grátis por 7 dias', 'Começar grátis'],
  ['Teste Pro por 7 dias', 'Plano Free · 5 créditos por dia'],
  ['Sem cartão durante o teste', 'Até 25 créditos gratuitos por mês'],
  [
    'Todos os novos usuários começam com acesso ao Pro por 7 dias. Depois, basta escolher o plano adequado ao ritmo da operação.',
    'Todos os novos usuários começam no Free com 5 créditos por dia, até 25 por mês. Faça upgrade quando precisar de mais capacidade, IA e recursos avançados.',
  ],
  ['Até 80 análises por mês', '80 créditos de prospecção por mês'],
  ['Até null mensagens com IA por mês', '10 conversas com a Scoutly AI por dia'],
];

function getCurrentLanguage(): 'en' | 'pt' {
  return document.documentElement.lang.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

function patchMarketingCopy(root: ParentNode = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();

  while (node) {
    const current = node.nodeValue || '';
    let next = current;
    for (const [from, to] of COPY_REPLACEMENTS) {
      if (next.includes(from)) next = next.replace(from, to);
    }
    if (next !== current) node.nodeValue = next;
    node = walker.nextNode();
  }
}

function OverviewVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasAutoPlayedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  const [language, setLanguage] = useState<'en' | 'pt'>(getCurrentLanguage);

  useEffect(() => {
    const syncLanguage = () => setLanguage(getCurrentLanguage());
    syncLanguage();

    const observer = new MutationObserver(syncLanguage);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang'],
    });

    return () => observer.disconnect();
  }, []);

  const videoUrl = language === 'pt' ? VIDEO_URL_PT : VIDEO_URL_EN;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    hasAutoPlayedRef.current = false;
    setFailed(false);
    setPlaying(false);
    video.load();
  }, [videoUrl]);

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
  }, [videoUrl]);

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

  const labels = language === 'pt'
    ? {
        loadError: 'Não foi possível carregar o vídeo.',
        overview: 'Visão geral da plataforma Scoutly',
        controls: 'Controles do vídeo',
        pause: 'Pausar vídeo',
        play: 'Reproduzir vídeo',
        soundOn: 'Ativar som',
        mute: 'Silenciar vídeo',
      }
    : {
        loadError: 'Unable to load the video.',
        overview: 'Scoutly platform overview',
        controls: 'Video controls',
        pause: 'Pause video',
        play: 'Play video',
        soundOn: 'Turn sound on',
        mute: 'Mute video',
      };

  return (
    <div className="site-product-video-layer" onContextMenu={(event) => event.preventDefault()}>
      {failed ? (
        <div className="site-video-status">{labels.loadError}</div>
      ) : (
        <>
          <video
            ref={videoRef}
            src={videoUrl}
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
            aria-label={labels.overview}
          />

          <div className="site-video-controls" aria-label={labels.controls}>
            <button
              type="button"
              className="site-video-control"
              onClick={togglePlayback}
              aria-label={playing ? labels.pause : labels.play}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className="site-video-control"
              onClick={toggleSound}
              aria-label={muted ? labels.soundOn : labels.mute}
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

    const sync = () => {
      findTarget();
      patchMarketingCopy(document.body);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  if (!target) return null;
  return createPortal(<OverviewVideo />, target);
}

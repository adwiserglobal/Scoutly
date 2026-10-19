import { useEffect, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { HELP_ARTICLES, type HelpArticle, type HelpImage } from '../data/helpArticles';

interface HelpArticleViewProps {
  article: HelpArticle;
  onOpenArticle: (id: string) => void;
  onContactSupport: () => void;
}

function Figure({ image, onZoom }: { image: HelpImage; onZoom: (image: HelpImage) => void }) {
  return (
    <figure className="min-w-0">
      <button
        type="button"
        onClick={() => onZoom(image)}
        className="group block w-full overflow-hidden rounded-xl border border-[#dfe1e3] bg-[#0d1014] shadow-[0_10px_30px_rgba(0,0,0,.08)] transition hover:border-[#ff9c70]"
        aria-label={`Ampliar imagem: ${image.alt}`}
      >
        <img
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
      </button>
      {image.caption && <figcaption className="mt-2 text-center text-[11px] text-[#85898d]">{image.caption}</figcaption>}
    </figure>
  );
}

export default function HelpArticleView({ article, onOpenArticle, onContactSupport }: HelpArticleViewProps) {
  const [zoomed, setZoomed] = useState<HelpImage | null>(null);
  const related = HELP_ARTICLES.filter((item) => item.id !== article.id).slice(0, 3);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setZoomed(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [zoomed]);

  return (
    <main className="mx-auto w-full max-w-[820px] flex-1 px-6 pb-24 pt-12 sm:px-10 sm:pt-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff6a26]">{article.tag}</p>
      <h1 className="mt-3 text-[30px] font-semibold leading-[1.15] tracking-[-0.035em] text-[#202124] sm:text-[36px]">
        {article.title}
      </h1>
      <p className="mt-2 text-[12px] text-[#8b8e92]">{article.readMinutes} min de leitura</p>
      <p className="mt-6 text-[15px] leading-7 text-[#4f5357]">{article.intro}</p>

      <ol className="mt-10 space-y-10">
        {article.steps.map((step, index) => (
          <li key={step.title} className="relative pl-12">
            <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#242629] text-[13px] font-semibold text-white">
              {index + 1}
            </span>
            <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-[#2b2e31]">{step.title}</h2>
            <p className="mt-2 text-[14px] leading-7 text-[#5b5f63]">{step.body}</p>
            {step.images && step.images.length > 0 && (
              <div className={`mt-5 grid gap-4 ${step.images.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                {step.images.map((image) => (
                  <Figure key={image.src} image={image} onZoom={setZoomed} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      {article.tips && article.tips.length > 0 && (
        <aside className="mt-12 rounded-xl border border-[#f0d3c4] bg-[#fff7f2] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d85b21]">Dicas</p>
          <ul className="mt-3 space-y-2.5">
            {article.tips.map((tip) => (
              <li key={tip} className="flex gap-2.5 text-[13px] leading-6 text-[#5b4a40]">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff6a26]" />
                {tip}
              </li>
            ))}
          </ul>
        </aside>
      )}

      <section className="mt-12 flex flex-col gap-4 rounded-xl border border-[#e1e3e5] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[14px] font-semibold text-[#2b2e31]">Ainda com dúvida?</p>
          <p className="mt-1 text-[12px] text-[#7b7f83]">Fale com a equipe Scoutly e responderemos o quanto antes.</p>
        </div>
        <button
          type="button"
          onClick={onContactSupport}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#242629] px-4 text-[12px] font-semibold text-white transition hover:bg-[#161718]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff6a26]" />
          Preciso de ajuda
        </button>
      </section>

      {related.length > 0 && (
        <section className="mt-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b8e92]">Outros artigos</p>
          <div className="mt-3 overflow-hidden rounded-xl border border-[#e1e3e5] bg-white">
            {related.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenArticle(item.id)}
                className={`group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-[#f7f7f6] ${index > 0 ? 'border-t border-[#eceeef]' : ''}`}
              >
                <span className="min-w-0 flex-1 text-[13px] font-semibold text-[#2f3235]">{item.title}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#a7aaad] transition group-hover:translate-x-0.5 group-hover:text-[#ff6a26]" />
              </button>
            ))}
          </div>
        </section>
      )}

      {zoomed && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setZoomed(null)}
          role="dialog"
          aria-label={zoomed.alt}
        >
          <button
            type="button"
            onClick={() => setZoomed(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Fechar imagem"
          >
            <X className="h-5 w-5" />
          </button>
          <img src={zoomed.src} alt={zoomed.alt} className="max-h-full max-w-full rounded-lg object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </main>
  );
}

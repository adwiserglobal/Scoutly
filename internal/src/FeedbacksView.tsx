import { RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { BusinessFeedback } from './types';

export type FeedbackFilter = 'down' | 'all' | 'up';

const ISSUE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  site: 'Site',
  redes_sociais: 'Redes sociais',
  outros: 'Outros',
};

const FILTERS: Array<{ id: FeedbackFilter; label: string }> = [
  { id: 'down', label: 'Dados a melhorar' },
  { id: 'all', label: 'Todos' },
  { id: 'up', label: 'Positivos' },
];

export default function FeedbacksView({
  rows,
  filter,
  loading,
  onFilter,
  onReload,
}: {
  rows: BusinessFeedback[];
  filter: FeedbackFilter;
  loading: boolean;
  onFilter: (value: FeedbackFilter) => void;
  onReload: () => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUALIDADE DOS DADOS</span>
          <h1>Feedbacks</h1>
          <p>Avaliações de "Os dados estão atualizados?" feitas pelos clientes nos cards de empresas.</p>
        </div>
        <button className="ghost-button" onClick={onReload} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar
        </button>
      </div>

      <div className="feedback-filters">
        {FILTERS.map((item) => (
          <button key={item.id} className={filter === item.id ? 'active' : ''} onClick={() => onFilter(item.id)}>
            {item.label}
          </button>
        ))}
        <span>
          {rows.length} {rows.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      <section className="panel feedback-list">
        {rows.map((row) => {
          const snap = row.business_snapshot || {};
          const shown = snap.shown || {};
          const mapsUrl =
            snap.googleMapsUrl ||
            (snap.googlePlaceId ? `https://www.google.com/maps/place/?q=place_id:${snap.googlePlaceId}` : null);

          return (
            <article className="feedback-row" key={row.id}>
              <div className="feedback-who">
                <span className={`pill ${row.rating === 'down' ? 'danger' : 'success'}`}>
                  {row.rating === 'down' ? <ThumbsDown size={11} /> : <ThumbsUp size={11} />}
                  {row.rating === 'down' ? 'Melhorar' : 'Positivo'}
                </span>
                <strong>{row.user_email || row.user_uid}</strong>
                <small>{new Date(row.updated_at).toLocaleString('pt-BR')}</small>
              </div>

              <div className="feedback-business">
                <strong>{row.business_name || snap.name || row.business_id}</strong>
                <span>{[snap.category, snap.address].filter(Boolean).join(' • ') || '—'}</span>
                <div className="feedback-shown">
                  {shown.website && (
                    <a href={shown.website} target="_blank" rel="noopener noreferrer">
                      Site: {shown.website}
                    </a>
                  )}
                  {shown.phone && <span>Telefone: {shown.phone}</span>}
                  {shown.whatsapp && <span>WhatsApp: {shown.whatsapp}</span>}
                  {(shown.socials || []).map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                      {url.replace(/^https?:\/\/(www\.)?/, '')}
                    </a>
                  ))}
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                      Google Maps
                    </a>
                  )}
                </div>
                <small>
                  ID {row.business_id}
                  {snap.source ? ` • ${snap.source}` : ''}
                </small>
              </div>

              <div className="feedback-issues">
                {row.rating === 'down' ? (
                  (row.issues || []).map((issue) => (
                    <span className="pill warning" key={issue}>
                      {ISSUE_LABELS[issue] || issue}
                    </span>
                  ))
                ) : (
                  <span className="muted-text">Dados corretos</span>
                )}
              </div>
            </article>
          );
        })}
        {rows.length === 0 && (
          <div className="empty-mini">{loading ? 'Carregando feedbacks...' : 'Nenhum feedback neste filtro ainda.'}</div>
        )}
      </section>
    </>
  );
}

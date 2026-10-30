// Mapa de telas do SGI. "disponivel: false" = módulo ainda em migração a partir do protótipo.

export interface Rota {
  id: string;
  titulo: string;
  disponivel: boolean;
}

export const ROTAS: readonly Rota[] = [
  { id: 'dashboard', titulo: 'Dashboard', disponivel: true },
  { id: 'demandas', titulo: 'Demandas', disponivel: true },
  { id: 'projetos', titulo: 'Projetos', disponivel: false },
  { id: 'reunioes', titulo: 'Reuniões e atas', disponivel: false },
  { id: 'presencas', titulo: 'Presenças', disponivel: false },
  { id: 'pontuacoes', titulo: 'Pontuações', disponivel: false },
  { id: 'ranking', titulo: 'Ranking', disponivel: false },
  { id: 'estrutura', titulo: 'Estrutura e equipe', disponivel: false },
  { id: 'acessos', titulo: 'Acessos', disponivel: false },
  { id: 'historico', titulo: 'Histórico completo', disponivel: false },
  { id: 'regras', titulo: 'Regras', disponivel: false },
];

const ROTA_INICIAL: Rota = { id: 'dashboard', titulo: 'Dashboard', disponivel: true };

/** Converte "#demandas" ou "#/demandas" na rota; hash vazio ou desconhecido leva ao Dashboard. */
export function rotaDoHash(hash: string): Rota {
  const id = hash.replace(/^#\/?/, '').trim();
  return ROTAS.find((rota) => rota.id === id) ?? ROTA_INICIAL;
}

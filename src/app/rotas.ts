// Mapa de telas do SGI. "disponivel: false" = módulo ainda em migração a partir do protótipo.

export interface Rota {
  id: string;
  titulo: string;
  disponivel: boolean;
}

export const ROTAS: readonly Rota[] = [
  { id: 'dashboard', titulo: 'Tela Inicial', disponivel: true },
  { id: 'demandas', titulo: 'Demandas', disponivel: true },
  { id: 'projetos', titulo: 'Projetos', disponivel: false },
  { id: 'reunioes', titulo: 'Reuniões e atas', disponivel: true },
  { id: 'presencas', titulo: 'Presenças', disponivel: false },
  { id: 'pontuacoes', titulo: 'Pontuações', disponivel: false },
  { id: 'ranking', titulo: 'Ranking', disponivel: false },
  { id: 'estrutura', titulo: 'Estrutura e equipe', disponivel: false },
  { id: 'autorizacoes', titulo: 'Autorizações', disponivel: true },
  { id: 'historico', titulo: 'Histórico completo', disponivel: false },
  { id: 'regras', titulo: 'Regras', disponivel: false },
];

const ROTA_INICIAL: Rota = { id: 'dashboard', titulo: 'Tela Inicial', disponivel: true };

// endereços antigos que passaram a ser abas de Autorizações
const ENDERECOS_ANTIGOS: Readonly<Record<string, string>> = { acessos: 'autorizacoes', avais: 'autorizacoes' };

/** Converte "#demandas" ou "#/demandas" na rota; hash vazio ou desconhecido leva à Tela Inicial. */
export function rotaDoHash(hash: string): Rota {
  const texto = hash.replace(/^#\/?/, '').trim();
  const id = ENDERECOS_ANTIGOS[texto] ?? texto;
  return ROTAS.find((rota) => rota.id === id) ?? ROTA_INICIAL;
}

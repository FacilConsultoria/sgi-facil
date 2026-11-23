// Mapa de telas do SGI. "disponivel: false" = módulo ainda em migração a partir do protótipo.

export interface Rota {
  id: string;
  titulo: string;
  disponivel: boolean;
}

export const ROTAS: readonly Rota[] = [
  { id: 'dashboard', titulo: 'Tela Inicial', disponivel: true },
  { id: 'demandas', titulo: 'Demandas', disponivel: true },
  { id: 'projetos', titulo: 'Projetos', disponivel: true },
  { id: 'reunioes', titulo: 'Reuniões e atas', disponivel: true },
  { id: 'presencas', titulo: 'Presenças', disponivel: true },
  { id: 'disponibilidade', titulo: 'Disponibilidade', disponivel: true },
  { id: 'pontuacao', titulo: 'Pontuação e ranking', disponivel: true },
  { id: 'estrutura', titulo: 'Estrutura e equipe', disponivel: true },
  { id: 'autorizacoes', titulo: 'Autorizações', disponivel: true },
  { id: 'historico', titulo: 'Histórico completo', disponivel: true },
  { id: 'documentos', titulo: 'Documentos', disponivel: true },
  { id: 'regras', titulo: 'Regras', disponivel: true },
  { id: 'sugestoes', titulo: 'Sugestões', disponivel: true },
];

const ROTA_INICIAL: Rota = { id: 'dashboard', titulo: 'Tela Inicial', disponivel: true };

// endereços antigos que passaram a ser abas de Autorizações e de Pontuação e ranking
const ENDERECOS_ANTIGOS: Readonly<Record<string, string>> = {
  acessos: 'autorizacoes', avais: 'autorizacoes', pontuacoes: 'pontuacao', ranking: 'pontuacao',
};

/** Abas do trainee: só as dele (os dados de cada uma o banco já limita). */
const ABAS_DO_TRAINEE: readonly string[] = ['demandas', 'reunioes', 'presencas', 'disponibilidade'];

/** As abas do menu conforme o cargo. */
export function rotasDoPapel(papel: string): readonly Rota[] {
  return papel === 'trainee' ? ROTAS.filter((rota) => ABAS_DO_TRAINEE.includes(rota.id)) : ROTAS;
}

/**
 * Converte "#demandas" ou "#/demandas" na rota; hash vazio ou desconhecido leva à Tela Inicial
 * (ou, para quem não tem essa aba, à primeira aba do cargo).
 */
export function rotaDoHash(hash: string, papel = ''): Rota {
  const texto = hash.replace(/^#\/?/, '').trim();
  const id = ENDERECOS_ANTIGOS[texto] ?? texto;
  const rotas = rotasDoPapel(papel);
  return rotas.find((rota) => rota.id === id) ?? (rotas.includes(ROTAS[0] as Rota) ? ROTA_INICIAL : (rotas[0] ?? ROTA_INICIAL));
}

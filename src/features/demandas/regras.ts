// Regras de apresentação do módulo de Demandas. Funções puras, sem acesso a dados.
// Permissões não são calculadas aqui: chegam prontas das visões do banco
// (pode_gerir, pode_mudar_status, pode_criar_demanda) e só são lidas.
import { dataCompleta } from '../../lib/datas';
import type { DemandaVisivel, MotivoAcesso, PessoaAtribuivel, Prioridade, StatusDemanda } from '../../types/database';

export const STATUS: readonly { id: StatusDemanda; nome: string }[] = [
  { id: 'afazer', nome: 'A fazer' },
  { id: 'andamento', nome: 'Em andamento' },
  { id: 'revisao', nome: 'Em revisão' },
  { id: 'concluida', nome: 'Concluída' },
];

export const NOME_DO_STATUS: Record<StatusDemanda, string> = {
  afazer: 'A fazer',
  andamento: 'Em andamento',
  revisao: 'Em revisão',
  concluida: 'Concluída',
};

export const PRIORIDADES: readonly { id: Prioridade; nome: string }[] = [
  { id: 'alta', nome: 'Alta' },
  { id: 'media', nome: 'Média' },
  { id: 'baixa', nome: 'Baixa' },
];

export const NOME_DA_PRIORIDADE: Record<Prioridade, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

const ORDEM_DA_PRIORIDADE: Record<Prioridade, number> = { alta: 0, media: 1, baixa: 2 };

export const NOME_DO_MOTIVO: Record<MotivoAcesso, string> = {
  presidencia: 'Presidência',
  diretoria: 'Diretoria',
  nucleo: 'Núcleo',
  executor: 'Executor',
  excecao: 'Exceção',
};

export function estaAtrasada(demanda: Pick<DemandaVisivel, 'status' | 'prazo'>, hoje: string): boolean {
  return demanda.status !== 'concluida' && demanda.prazo < hoje;
}

// ---------- textos ----------

/** "Ana Ferraz" → "AF"; "Mel" → "M". */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}

/** Frase "Por que você vê esta demanda", a partir do motivo calculado pelo banco. */
export function explicarAcesso(
  demanda: Pick<DemandaVisivel, 'motivo_acesso' | 'area_id' | 'nucleo_nome' | 'excecao_ate'>,
  tituloDaArea: (id: string) => string,
): string {
  switch (demanda.motivo_acesso) {
    case 'presidencia':
      return 'A Presidência tem acesso irrestrito.';
    case 'diretoria':
      return `A demanda pertence à ${tituloDaArea(demanda.area_id)}, que você conduz.`;
    case 'nucleo':
      return `A demanda é do núcleo ${demanda.nucleo_nome}, que você lidera.`;
    case 'executor':
      return 'Você consta como executor desta demanda.';
    case 'excecao':
      return demanda.excecao_ate
        ? `Liberação por exceção válida até ${dataCompleta(demanda.excecao_ate)}. Acesso somente para consulta.`
        : 'Liberação por exceção. Acesso somente para consulta.';
  }
}

// ---------- quadro ----------

export interface Filtros {
  busca: string;
  projeto: string;
  executor: string;
  soMinhas: boolean;
}

export const FILTROS_VAZIOS: Filtros = { busca: '', projeto: '', executor: '', soMinhas: false };

/** Minúsculas e sem acentos, para a busca achar "revisao" em "Revisão". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function filtrarDemandas(demandas: readonly DemandaVisivel[], filtros: Filtros, meuId: string): DemandaVisivel[] {
  const busca = normalizar(filtros.busca);
  return demandas.filter((d) =>
    (!filtros.projeto || d.projeto_id === filtros.projeto)
    && (!filtros.executor || d.executores.includes(filtros.executor))
    && (!filtros.soMinhas || d.executores.includes(meuId))
    && (!busca || normalizar(d.titulo).includes(busca) || normalizar(d.codigo).includes(busca)));
}

/** Demandas de uma etapa, por prazo, depois prioridade e código. */
export function demandasDaEtapa(demandas: readonly DemandaVisivel[], status: StatusDemanda): DemandaVisivel[] {
  return demandas
    .filter((d) => d.status === status)
    .sort((a, b) => a.prazo.localeCompare(b.prazo)
      || ORDEM_DA_PRIORIDADE[a.prioridade] - ORDEM_DA_PRIORIDADE[b.prioridade]
      || a.codigo.localeCompare(b.codigo));
}

export interface Resumo {
  total: number;
  andamento: number;
  revisao: number;
  atrasadas: number;
  concluidas: number;
}

export function resumir(demandas: readonly DemandaVisivel[], hoje: string): Resumo {
  const contar = (status: StatusDemanda): number => demandas.filter((d) => d.status === status).length;
  return {
    total: demandas.length,
    andamento: contar('andamento'),
    revisao: contar('revisao'),
    atrasadas: demandas.filter((d) => estaAtrasada(d, hoje)).length,
    concluidas: contar('concluida'),
  };
}

/** Etapas oferecidas no seletor de status. Validar a conclusão é de quem gere (indicador do banco). */
export function statusPermitidos(demanda: Pick<DemandaVisivel, 'pode_gerir'>): StatusDemanda[] {
  return STATUS.map((s) => s.id).filter((id) => demanda.pode_gerir || id !== 'concluida');
}

// ---------- formulários ----------

export interface OpcaoDeExecutor {
  id: string;
  nome: string;
}

export interface GrupoDeExecutores {
  titulo: string;
  pessoas: OpcaoDeExecutor[];
}

/**
 * Organiza a lista de executores do formulário: primeiro quem é do núcleo do projeto,
 * depois o restante do escopo de quem edita (visão pessoas_atribuiveis) e, por último,
 * quem já está atribuído mas fora desse escopo (pode continuar, não pode ser incluído de novo).
 */
export function agruparExecutores(
  atribuiveis: readonly PessoaAtribuivel[],
  nucleoDoProjeto: string | null,
  selecionados: readonly string[],
  nomeDe: (id: string) => string,
): GrupoDeExecutores[] {
  const porNome = (a: OpcaoDeExecutor, b: OpcaoDeExecutor): number => a.nome.localeCompare(b.nome, 'pt-BR');
  const noEscopo = new Set(atribuiveis.map((p) => p.id));
  const doNucleo = atribuiveis.filter((p) => p.nucleo_id !== null && p.nucleo_id === nucleoDoProjeto);
  const demais = atribuiveis.filter((p) => !(p.nucleo_id !== null && p.nucleo_id === nucleoDoProjeto));
  const fora = selecionados.filter((id) => !noEscopo.has(id)).map((id) => ({ id, nome: nomeDe(id) }));
  const opcao = (p: PessoaAtribuivel): OpcaoDeExecutor => ({ id: p.id, nome: p.nome });
  return [
    { titulo: 'Núcleo do projeto', pessoas: doNucleo.map(opcao).sort(porNome) },
    { titulo: 'Outras pessoas no seu escopo', pessoas: demais.map(opcao).sort(porNome) },
    { titulo: 'Já atribuídos, fora do seu escopo', pessoas: fora.sort(porNome) },
  ].filter((grupo) => grupo.pessoas.length > 0);
}

export interface CamposDaDemanda {
  titulo: string;
  prazo: string;
  executores: readonly string[];
}

/** Checagem antes de enviar, com as mesmas mensagens do banco (que confere de novo). */
export function validarDemanda(campos: CamposDaDemanda): string | null {
  if (!campos.titulo.trim()) return 'Dê um título à demanda.';
  if (!campos.prazo) return 'Informe o prazo.';
  if (campos.executores.length === 0) return 'Atribua pelo menos um executor.';
  return null;
}

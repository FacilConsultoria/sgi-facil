// Regras de apresentação do módulo de Pontuação e ranking. Funções puras, sem acesso a dados.
// Permissões não são calculadas aqui: chegam prontas das visões pontuacao_pessoas e lancamentos_visiveis
// (pode_ajustar, pode_pedir_aval, pode_desconsiderar) e só são lidas.
import { dataCompleta } from '../../lib/datas';
import type { LancamentoVisivel, LinhaDoRanking, PessoaComPontuacao, TipoDeLancamento } from '../../types/database';

export const NOME_DO_TIPO_DE_LANCAMENTO: Record<TipoDeLancamento, string> = {
  demanda: 'Demanda',
  evento: 'Evento',
  falta: 'Falta',
  ajuste: 'Ajuste',
};

export type FiltroDeLancamentos = 'tudo' | TipoDeLancamento;

export const FILTROS_DE_LANCAMENTOS: readonly { id: FiltroDeLancamentos; nome: string }[] = [
  { id: 'tudo', nome: 'Tudo' },
  { id: 'demanda', nome: 'Demandas' },
  { id: 'evento', nome: 'Eventos' },
  { id: 'falta', nome: 'Faltas' },
  { id: 'ajuste', nome: 'Ajustes' },
];

/** Valor máximo de um ajuste ou evento, em módulo (o banco confere de novo). */
export const LIMITE_DO_AJUSTE = 20;
export const MINIMO_DE_CARACTERES_DA_JUSTIFICATIVA = 15;
export const MINIMO_DE_CARACTERES_DO_MOTIVO = 10;

/** "+2", "−2" (sinal de menos de verdade) ou "0". */
export function comSinal(valor: number): string {
  if (valor > 0) return `+${valor}`;
  if (valor < 0) return `−${Math.abs(valor)}`;
  return '0';
}

/** Mais recentes primeiro: pela data de referência e, no mesmo dia, pelo momento do lançamento. */
export function ordenarLancamentos(lancamentos: readonly LancamentoVisivel[]): LancamentoVisivel[] {
  return [...lancamentos].sort((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em));
}

export function contarDesconsiderados(lancamentos: readonly LancamentoVisivel[]): number {
  return lancamentos.filter((l) => l.desconsiderado_em !== null).length;
}

/** Aplica o filtro por tipo e, quando não se pede para mostrá-los, tira os lançamentos desconsiderados. */
export function filtrarLancamentos(
  lancamentos: readonly LancamentoVisivel[],
  filtro: FiltroDeLancamentos,
  mostrarDesconsiderados: boolean,
): LancamentoVisivel[] {
  return ordenarLancamentos(lancamentos).filter(
    (l) => (mostrarDesconsiderados || l.desconsiderado_em === null) && (filtro === 'tudo' || l.tipo === filtro),
  );
}

/** "Entrega no prazo: PRJ-001 · Fluxo AS-IS"; sem acesso à demanda, "Entrega no prazo: demanda de outra área". */
export function descreverLancamento(l: Pick<LancamentoVisivel, 'descricao' | 'demanda_id' | 'demanda_codigo' | 'demanda_titulo'>): string {
  if (!l.demanda_id) return l.descricao;
  const demanda = l.demanda_codigo ? `${l.demanda_codigo} · ${l.demanda_titulo ?? ''}`.trim() : 'demanda de outra área';
  return `${l.descricao}: ${demanda}`;
}

export interface PosicaoNoRanking {
  posicao: number;
  total: number;
}

/** Posição da pessoa no ranking que quem consulta enxerga; nulo quando ela não aparece nele. */
export function posicaoNoRanking(ranking: readonly LinhaDoRanking[], pessoaId: string): PosicaoNoRanking | null {
  const indice = ranking.findIndex((linha) => linha.pessoa_id === pessoaId);
  return indice < 0 ? null : { posicao: indice + 1, total: ranking.length };
}

/** "3º de 11" ou "–" quando a pessoa não está no ranking visível. */
export function descreverPosicao(posicao: PosicaoNoRanking | null): string {
  return posicao ? `${posicao.posicao}º de ${posicao.total}` : '–';
}

/** Ordem alfabética (sem diferenciar acentos) e, na busca, só os nomes que contêm o texto. */
export function listarPessoas(pessoas: readonly PessoaComPontuacao[], busca: string): PessoaComPontuacao[] {
  const normalizar = (texto: string): string => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const termo = normalizar(busca.trim());
  return pessoas
    .filter((p) => !termo || normalizar(p.nome).includes(termo))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Quem aparece selecionada ao abrir: a própria pessoa, se estiver na lista; senão a primeira. */
export function pessoaInicial(pessoas: readonly PessoaComPontuacao[], meuId: string, anterior: string | null): string | null {
  const ordenadas = listarPessoas(pessoas, '');
  const lembrada = anterior ? ordenadas.find((p) => p.id === anterior) : undefined;
  return (lembrada ?? ordenadas.find((p) => p.id === meuId) ?? ordenadas[0])?.id ?? null;
}

/** "2 projetos ativos" a partir dos nomes visíveis e da quantidade oculta; "Nenhum projeto ativo" quando não há nenhum. */
export function descreverProjetosAtivos(visiveis: readonly string[], ocultos: number): string {
  const partes = [...visiveis, ...(ocultos > 0 ? [ocultos === 1 ? 'Projeto de outra área' : `${ocultos} projetos de outras áreas`] : [])];
  return partes.length ? partes.join(' | ') : 'Nenhum projeto ativo';
}

export interface CamposDoAjuste {
  valor: string;
  data: string;
  justificativa: string;
}

/** Checagem antes de enviar, com as mesmas mensagens do banco (que confere de novo). */
export function validarAjuste(campos: CamposDoAjuste, hoje: string): string | null {
  const valor = Number(campos.valor);
  if (campos.valor.trim() === '' || !Number.isInteger(valor) || valor === 0 || Math.abs(valor) > LIMITE_DO_AJUSTE) {
    return `Informe um valor inteiro entre −${LIMITE_DO_AJUSTE} e ${LIMITE_DO_AJUSTE}, diferente de zero.`;
  }
  if (!campos.data || campos.data > hoje) return 'Informe uma data de referência até hoje.';
  if (campos.justificativa.trim().length < MINIMO_DE_CARACTERES_DA_JUSTIFICATIVA) {
    return `Explique o ajuste em pelo menos ${MINIMO_DE_CARACTERES_DA_JUSTIFICATIVA} caracteres.`;
  }
  return null;
}

export function validarMotivoDaDesconsideracao(motivo: string): string | null {
  return motivo.trim().length < MINIMO_DE_CARACTERES_DO_MOTIVO
    ? `Escreva o motivo (mínimo ${MINIMO_DE_CARACTERES_DO_MOTIVO} caracteres).`
    : null;
}

/**
 * Resumo lido por quem dá o aval. Se o aval for aprovado, o banco usa este texto como descrição do
 * lançamento (e exige pelo menos 15 caracteres).
 */
export function resumoDoPedidoDeAjusteProprio(tipo: 'ajuste' | 'evento', valor: number, data: string, justificativa: string): string {
  const nome = tipo === 'evento' ? 'Evento' : 'Ajuste';
  return `${nome} de ${comSinal(valor)} ponto${Math.abs(valor) === 1 ? '' : 's'} na própria pontuação (${dataCompleta(data)}): ${justificativa.trim()}`;
}

/** Frase do cabeçalho do ranking, conforme a regra de visibilidade. */
export function introducaoDoRanking(rankingPublico: boolean): string {
  return rankingPublico
    ? 'Pontuação de todas as pessoas. Empates são ordenados por nome.'
    : 'O ranking está restrito: você vê apenas as pessoas do seu escopo.';
}

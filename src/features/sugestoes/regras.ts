// Regras de apresentação da tela Sugestões. Funções puras, sem acesso a dados.
// Quem pode responder (pode_responder) e quem já apoiou (apoiei) chegam prontos da visão sugestoes_painel.
import { dataCurta, hojeEmSaoPaulo } from '../../lib/datas';
import type { SituacaoDaSugestao, SugestaoDoPainel, TipoDeSugestao } from '../../types/database';

export const TIPOS_DE_SUGESTAO: readonly { id: TipoDeSugestao; nome: string }[] = [
  { id: 'melhoria', nome: 'Melhoria' },
  { id: 'bug', nome: 'Bug' },
  { id: 'outro', nome: 'Outro' },
];

export const SITUACOES_DE_SUGESTAO: readonly { id: SituacaoDaSugestao; nome: string; emAberto: boolean }[] = [
  { id: 'aberta', nome: 'Aberta', emAberto: true },
  { id: 'em_analise', nome: 'Em análise', emAberto: true },
  { id: 'planejada', nome: 'Planejada', emAberto: true },
  { id: 'feita', nome: 'Feita', emAberto: false },
  { id: 'recusada', nome: 'Recusada', emAberto: false },
];

export const LIMITE_DO_TITULO_DA_SUGESTAO = 120;
export const LIMITE_DA_DESCRICAO_DA_SUGESTAO = 2000;
export const LIMITE_DO_COMENTARIO = 1000;
export const LIMITE_DA_RESPOSTA = 1000;

export function nomeDoTipo(tipo: TipoDeSugestao): string {
  return TIPOS_DE_SUGESTAO.find((t) => t.id === tipo)?.nome ?? tipo;
}

export function nomeDaSituacao(situacao: SituacaoDaSugestao): string {
  return SITUACOES_DE_SUGESTAO.find((s) => s.id === situacao)?.nome ?? situacao;
}

export function estaEmAberto(situacao: SituacaoDaSugestao): boolean {
  return SITUACOES_DE_SUGESTAO.find((s) => s.id === situacao)?.emAberto ?? true;
}

export type GrupoDeSugestoes = 'em_aberto' | 'concluidas' | 'todas';

export interface FiltroDeSugestoes {
  grupo: GrupoDeSugestoes;
  tipo: TipoDeSugestao | '';
  busca: string;
}

export const FILTRO_INICIAL: FiltroDeSugestoes = { grupo: 'em_aberto', tipo: '', busca: '' };

const semAcento = (texto: string): string => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Filtra por grupo (em aberto ou concluídas), tipo e texto; ordena pelas mais apoiadas e, no empate, pelas mais novas. */
export function filtrarSugestoes(lista: readonly SugestaoDoPainel[], filtro: FiltroDeSugestoes): SugestaoDoPainel[] {
  const busca = semAcento(filtro.busca.trim());
  return lista
    .filter((s) => filtro.grupo === 'todas' || (filtro.grupo === 'em_aberto') === estaEmAberto(s.situacao))
    .filter((s) => filtro.tipo === '' || s.tipo === filtro.tipo)
    .filter((s) => busca === '' || semAcento(`${s.titulo} ${s.descricao}`).includes(busca))
    .sort((a, b) => b.apoios - a.apoios || b.criado_em.localeCompare(a.criado_em));
}

/** Quantas há em cada grupo, para os rótulos das abas. */
export function contarPorGrupo(lista: readonly SugestaoDoPainel[]): Record<GrupoDeSugestoes, number> {
  const emAberto = lista.filter((s) => estaEmAberto(s.situacao)).length;
  return { em_aberto: emAberto, concluidas: lista.length - emAberto, todas: lista.length };
}

/** "Ana · 05/11". */
export function descreverAutoria(sugestao: Pick<SugestaoDoPainel, 'autor_nome' | 'criado_em'>): string {
  return `${sugestao.autor_nome} · ${dataCurta(hojeEmSaoPaulo(new Date(sugestao.criado_em)))}`;
}

/** "1 apoio" / "3 apoios". */
export function descreverApoios(apoios: number): string {
  return apoios === 1 ? '1 apoio' : `${apoios} apoios`;
}

export interface SugestaoDigitada {
  tipo: string;
  titulo: string;
  descricao: string;
}

/** Mensagem do primeiro problema, ou null. As mesmas regras valem no banco. */
export function validarSugestao(sugestao: SugestaoDigitada): string | null {
  if (!TIPOS_DE_SUGESTAO.some((t) => t.id === sugestao.tipo)) return 'Escolha o tipo da sugestão.';
  const titulo = sugestao.titulo.trim();
  if (titulo === '') return 'Dê um título à sugestão.';
  if (titulo.length > LIMITE_DO_TITULO_DA_SUGESTAO) return `O título pode ter até ${LIMITE_DO_TITULO_DA_SUGESTAO} caracteres.`;
  const descricao = sugestao.descricao.trim();
  if (descricao === '') return 'Descreva a sugestão.';
  if (descricao.length > LIMITE_DA_DESCRICAO_DA_SUGESTAO) return `A descrição pode ter até ${LIMITE_DA_DESCRICAO_DA_SUGESTAO} caracteres.`;
  return null;
}

export function validarComentario(texto: string): string | null {
  const limpo = texto.trim();
  if (limpo === '') return 'Escreva o comentário.';
  if (limpo.length > LIMITE_DO_COMENTARIO) return `O comentário pode ter até ${LIMITE_DO_COMENTARIO} caracteres.`;
  return null;
}

export function validarResposta(situacao: string, resposta: string): string | null {
  if (!SITUACOES_DE_SUGESTAO.some((s) => s.id === situacao)) return 'Escolha a situação.';
  if (resposta.trim().length > LIMITE_DA_RESPOSTA) return `A resposta pode ter até ${LIMITE_DA_RESPOSTA} caracteres.`;
  return null;
}

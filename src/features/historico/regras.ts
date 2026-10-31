// Regras de apresentação do módulo Histórico completo. Funções puras, sem acesso a dados.
// Quem vê cada registro é decisão do banco (a regra de leitura da auditoria); aqui só se prepara a busca e o texto.
import type { RegistroDoHistorico } from '../../types/database';

/** Registros por página; "Carregar mais" traz a seguinte. */
export const TAMANHO_DA_PAGINA = 100;

/** Tira do texto os caracteres que têm sentido nos filtros do banco (vírgula, parênteses, curingas, aspas). */
export function termoDeBusca(texto: string): string {
  return texto.replace(/[,()*%\\"'_]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Filtro "ou" do PostgREST: o termo em qualquer parte da ação, do detalhe ou do nome de quem fez. Vazio sem termo. */
export function filtroDeBusca(texto: string): string | null {
  const termo = termoDeBusca(texto);
  return termo ? `acao.ilike.*${termo}*,detalhe.ilike.*${termo}*,ator_nome.ilike.*${termo}*` : null;
}

export function descreverAtor(registro: Pick<RegistroDoHistorico, 'ator_nome'>): string {
  return registro.ator_nome ?? 'Integração automática';
}

/** Id do último registro da lista (a página seguinte começa antes dele); nulo para lista vazia. */
export function cursorDaProximaPagina(registros: readonly RegistroDoHistorico[]): number | null {
  const ultimo = registros[registros.length - 1];
  return ultimo ? ultimo.id : null;
}

/** Uma página cheia sugere que há mais registros; uma incompleta, que a lista acabou. */
export function haMaisRegistros(recebidos: number): boolean {
  return recebidos >= TAMANHO_DA_PAGINA;
}

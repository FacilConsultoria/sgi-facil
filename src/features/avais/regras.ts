// Regras de apresentação do módulo de Avais. Funções puras, sem acesso a dados.
// Aval = pedido que depende da Presidente ou da Vice-Presidência; ao aprovar, o banco executa a ação.
import type { AvalVisivel, StatusDeAval, TipoDeAval } from '../../types/database';

export const NOME_DO_TIPO_DE_AVAL: Record<TipoDeAval, string> = {
  ajuste_proprio: 'Ajuste da própria pontuação',
  decidir_solicitacao: 'Acesso por exceção',
  justificar_falta: 'Falta de diretoria',
};

export const NOME_DO_STATUS_DE_AVAL: Record<StatusDeAval, string> = {
  pendente: 'Aguardando decisão',
  aprovado: 'Aprovado',
  negado: 'Negado',
};

/** Pendentes da mais antiga para a mais nova (quem pediu primeiro é atendido primeiro); decididos do mais recente. */
export function separarAvais(avais: readonly AvalVisivel[]): { pendentes: AvalVisivel[]; decididos: AvalVisivel[] } {
  return {
    pendentes: avais.filter((a) => a.status === 'pendente').sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
    decididos: avais.filter((a) => a.status !== 'pendente').sort((a, b) => (b.decidido_em ?? '').localeCompare(a.decidido_em ?? '')),
  };
}

/** O que será feito se o aval for aprovado, em uma frase curta. */
export function descreverAcaoDoAval(aval: Pick<AvalVisivel, 'tipo' | 'payload'>): string {
  const { payload } = aval;
  switch (aval.tipo) {
    case 'ajuste_proprio': {
      const valor = Number(payload.valor);
      return `Lançar ${valor > 0 ? '+' : ''}${valor} ponto${Math.abs(valor) === 1 ? '' : 's'} (${payload.tipo === 'evento' ? 'evento' : 'ajuste'}) para quem pediu`;
    }
    case 'decidir_solicitacao':
      return payload.aprovar === true ? 'Aprovar o pedido de acesso por exceção' : 'Negar o pedido de acesso por exceção';
    case 'justificar_falta':
      return 'Marcar a falta como justificada na lista de presença';
  }
}

// Regras de apresentação do módulo de Acessos por exceção. Funções puras, sem acesso a dados.
// Permissões não são calculadas aqui: chegam prontas da visão solicitacoes_visiveis
// (pode_aprovar, pode_revogar, pode_pedir_aval) e só são lidas.
import { dataCompleta, somarDias } from '../../lib/datas';
import type { AlvoDeSolicitacao, SituacaoDeSolicitacao, SolicitacaoVisivel } from '../../types/database';

export const NOME_DA_SITUACAO: Record<SituacaoDeSolicitacao, string> = {
  pendente: 'Aguardando decisão',
  aprovada: 'Acesso vigente',
  negada: 'Negado',
  revogada: 'Revogado',
  expirada: 'Expirado',
};

export const PRAZO_MAXIMO_EM_DIAS = 90;
export const PRAZO_PADRAO_EM_DIAS = 30;

export interface GruposDeSolicitacoes {
  /** Pedidos que quem consulta pode decidir agora ou, na Assessoria, pedir aval para decidir. */
  paraDecidir: SolicitacaoVisivel[];
  /** Pedidos pendentes que outras pessoas decidem. */
  pendentes: SolicitacaoVisivel[];
  /** Acessos em vigor. */
  vigentes: SolicitacaoVisivel[];
  /** Negados, revogados e expirados. */
  encerrados: SolicitacaoVisivel[];
}

/** Pendentes do mais antigo (quem pediu primeiro é atendido primeiro); vigentes pelo vencimento; encerrados do mais recente. */
export function separarSolicitacoes(solicitacoes: readonly SolicitacaoVisivel[]): GruposDeSolicitacoes {
  const pendentes = solicitacoes.filter((s) => s.situacao === 'pendente').sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  const acionaveis = (s: SolicitacaoVisivel): boolean => s.pode_aprovar || s.pode_pedir_aval;
  return {
    paraDecidir: pendentes.filter(acionaveis),
    pendentes: pendentes.filter((s) => !acionaveis(s)),
    vigentes: solicitacoes.filter((s) => s.situacao === 'aprovada').sort((a, b) => a.valido_ate.localeCompare(b.valido_ate)),
    encerrados: solicitacoes
      .filter((s) => s.situacao === 'negada' || s.situacao === 'revogada' || s.situacao === 'expirada')
      .sort((a, b) => (b.revogado_em ?? b.decidido_em ?? b.criado_em).localeCompare(a.revogado_em ?? a.decidido_em ?? a.criado_em)),
  };
}

/** "válido até 30/11/2026"; para pedido pendente, "validade pedida: até 30/11/2026". */
export function descreverValidade(solicitacao: Pick<SolicitacaoVisivel, 'valido_ate' | 'situacao'>): string {
  const data = dataCompleta(solicitacao.valido_ate);
  return solicitacao.situacao === 'pendente' ? `Validade pedida: até ${data}` : `Válido até ${data}`;
}

export interface CamposDoPedidoDeAcesso {
  beneficiario: string;
  alvo: AlvoDeSolicitacao;
  projeto: string;
  codigo: string;
  justificativa: string;
  validade: string;
}

/** Limites do campo de validade: de amanhã a 90 dias. */
export function limitesDaValidade(hoje: string): { minimo: string; padrao: string; maximo: string } {
  return { minimo: somarDias(hoje, 1), padrao: somarDias(hoje, PRAZO_PADRAO_EM_DIAS), maximo: somarDias(hoje, PRAZO_MAXIMO_EM_DIAS) };
}

/** Checagem antes de enviar, com as mesmas mensagens do banco (que confere de novo). */
export function validarPedidoDeAcesso(campos: CamposDoPedidoDeAcesso, hoje: string): string | null {
  const { minimo, maximo } = limitesDaValidade(hoje);
  if (!campos.beneficiario) return 'Escolha para quem é o acesso.';
  if (campos.alvo === 'projeto' && !campos.projeto) return 'Escolha um projeto da lista.';
  if (campos.alvo === 'demanda' && !campos.codigo.trim()) return 'Informe o código da demanda, como PRJ-001.';
  if (campos.justificativa.trim().length < 20) return 'Escreva uma justificativa com pelo menos 20 caracteres.';
  if (!campos.validade || campos.validade < minimo || campos.validade > maximo) return 'Escolha uma validade entre amanhã e 90 dias.';
  return null;
}

/** Nome do que se pede, no título de cada cartão: "Ana Ferraz → Mapeamento de processos · Padaria". */
export function tituloDoPedido(nomeDoBeneficiario: string, alvoNome: string): string {
  return `${nomeDoBeneficiario} → ${alvoNome}`;
}

/** Resumo lido por quem dá o aval (o banco exige pelo menos 15 caracteres). */
export function resumoDoPedidoDeAvalDeDecisao(aprovar: boolean, nomeDoBeneficiario: string, alvoNome: string, nota: string): string {
  const acao = aprovar ? 'Aprovar' : 'Negar';
  const complemento = nota.trim() ? `: ${nota.trim()}` : '';
  return `${acao} o acesso por exceção de ${nomeDoBeneficiario} a ${alvoNome}${complemento}`;
}

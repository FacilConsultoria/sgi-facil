// Acesso a dados do módulo de Acessos por exceção: leituras pelas visões do banco (já filtradas
// pela RLS) e gravações só pelas funções do banco (supabase.rpc).
import { supabase } from '../../lib/supabase';
import type { AlvoDeSolicitacao, PessoaAtribuivel, PessoaResumo, ProjetoSolicitavel, SolicitacaoVisivel } from '../../types/database';

export interface DadosDosAcessos {
  solicitacoes: SolicitacaoVisivel[];
  /** Pessoas para quem quem consulta pode pedir acesso. */
  beneficiarios: PessoaAtribuivel[];
  nomeDe: (id: string) => string;
}

export async function carregarAcessos(): Promise<DadosDosAcessos> {
  const [solicitacoes, beneficiarios, pessoas] = await Promise.all([
    supabase.from('solicitacoes_visiveis').select('*'),
    supabase.from('beneficiarios_de_acesso').select('*').order('nome'),
    supabase.from('pessoas').select('id, nome'),
  ]);
  for (const resposta of [solicitacoes, beneficiarios, pessoas]) {
    if (resposta.error) throw resposta.error;
  }
  const nomes = new Map<string, string>();
  for (const pessoa of (pessoas.data ?? []) as PessoaResumo[]) nomes.set(pessoa.id, pessoa.nome);
  return {
    solicitacoes: (solicitacoes.data ?? []) as SolicitacaoVisivel[],
    beneficiarios: (beneficiarios.data ?? []) as PessoaAtribuivel[],
    nomeDe: (id) => nomes.get(id) ?? 'Pessoa sem cadastro',
  };
}

/** Projetos que podem ser pedidos para a pessoa (o banco só responde a quem pode pedir para ela). */
export async function carregarProjetosSolicitaveis(beneficiarioId: string): Promise<ProjetoSolicitavel[]> {
  const { data, error } = await supabase.rpc('projetos_solicitaveis', { p_beneficiario: beneficiarioId });
  if (error) throw error;
  return (data ?? []) as ProjetoSolicitavel[];
}

export interface NovoPedidoDeAcesso {
  beneficiarioId: string;
  alvo: AlvoDeSolicitacao;
  projetoId: string | null;
  codigoDaDemanda: string | null;
  justificativa: string;
  validoAte: string;
}

export async function pedirAcesso(pedido: NovoPedidoDeAcesso): Promise<void> {
  const { error } = await supabase.rpc('solicitar_acesso', {
    p_beneficiario: pedido.beneficiarioId,
    p_alvo: pedido.alvo,
    p_projeto: pedido.projetoId,
    p_codigo: pedido.codigoDaDemanda,
    p_justificativa: pedido.justificativa,
    p_valido_ate: pedido.validoAte,
  });
  if (error) throw error;
}

export async function decidirPedido(solicitacaoId: string, aprovar: boolean, nota: string): Promise<void> {
  const { error } = await supabase.rpc('decidir_solicitacao', { p_solicitacao: solicitacaoId, p_aprovar: aprovar, p_nota: nota || null });
  if (error) throw error;
}

export async function revogarAcesso(solicitacaoId: string): Promise<void> {
  const { error } = await supabase.rpc('revogar_acesso', { p_solicitacao: solicitacaoId });
  if (error) throw error;
}

/** Assessoria de Presidência: pede à Presidente ou à Vice que aceitem a decisão dela sobre o pedido. */
export async function pedirAvalDeDecisao(solicitacaoId: string, aprovar: boolean, nota: string, resumo: string): Promise<void> {
  const { error } = await supabase.rpc('solicitar_aval', {
    p_tipo: 'decidir_solicitacao',
    p_payload: { solicitacao: solicitacaoId, aprovar, nota: nota || null },
    p_resumo: resumo,
  });
  if (error) throw error;
}

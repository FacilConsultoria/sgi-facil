// Acesso a dados do módulo de Pontuação e ranking: leituras pelas visões e pela função ranking() do banco
// (já filtradas pela RLS e pelas regras de visibilidade) e gravações só pelas funções do banco (supabase.rpc).
import { supabase } from '../../lib/supabase';
import type {
  ConfigDePontuacao, LancamentoVisivel, LinhaDoRanking, PessoaComPontuacao, PessoaResumo, TipoDeLancamento,
} from '../../types/database';

export interface DadosDoRanking {
  ranking: LinhaDoRanking[];
  config: ConfigDePontuacao;
}

export interface DadosDaPontuacao extends DadosDoRanking {
  /** Pessoas cuja pontuação detalhada quem consulta pode ver. */
  pessoas: PessoaComPontuacao[];
  nomeDe: (id: string) => string;
}

async function lerRanking(): Promise<DadosDoRanking> {
  const [ranking, config] = await Promise.all([
    supabase.rpc('ranking'),
    supabase.from('config').select('pontos_iniciais, ranking_publico').maybeSingle(),
  ]);
  if (ranking.error) throw ranking.error;
  if (config.error) throw config.error;
  if (!config.data) throw new Error('Configuração de pontuação não encontrada.');
  return { ranking: (ranking.data ?? []) as LinhaDoRanking[], config: config.data as ConfigDePontuacao };
}

export const carregarRanking = lerRanking;

export async function carregarPontuacao(): Promise<DadosDaPontuacao> {
  const [base, pessoas, nomes] = await Promise.all([
    lerRanking(),
    supabase.from('pontuacao_pessoas').select('*'),
    supabase.from('pessoas').select('id, nome'),
  ]);
  for (const resposta of [pessoas, nomes]) {
    if (resposta.error) throw resposta.error;
  }
  const porId = new Map<string, string>();
  for (const pessoa of (nomes.data ?? []) as PessoaResumo[]) porId.set(pessoa.id, pessoa.nome);
  return {
    ...base,
    pessoas: (pessoas.data ?? []) as PessoaComPontuacao[],
    nomeDe: (id) => porId.get(id) ?? 'Pessoa sem cadastro',
  };
}

/** Linha do tempo de uma pessoa, inclusive os lançamentos desconsiderados (a tela decide se os mostra). */
export async function carregarLancamentos(pessoaId: string): Promise<LancamentoVisivel[]> {
  const { data, error } = await supabase.from('lancamentos_visiveis').select('*').eq('pessoa_id', pessoaId);
  if (error) throw error;
  return (data ?? []) as LancamentoVisivel[];
}

export interface NovoAjuste {
  tipo: Extract<TipoDeLancamento, 'ajuste' | 'evento'>;
  valor: number;
  data: string;
  justificativa: string;
}

export async function lancarPontos(pessoaId: string, ajuste: NovoAjuste): Promise<void> {
  const { error } = await supabase.rpc('lancar_pontos', {
    p_pessoa: pessoaId,
    p_tipo: ajuste.tipo,
    p_valor: ajuste.valor,
    p_data: ajuste.data,
    p_justificativa: ajuste.justificativa,
  });
  if (error) throw error;
}

export async function desconsiderarLancamento(lancamentoId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('desconsiderar_lancamento', { p_lancamento: lancamentoId, p_motivo: motivo });
  if (error) throw error;
}

/** Assessoria de Presidência: pede à Presidente ou à Vice que aprovem um ajuste na própria pontuação. */
export async function pedirAvalDeAjusteProprio(ajuste: Pick<NovoAjuste, 'tipo' | 'valor' | 'data'>, resumo: string): Promise<void> {
  const { error } = await supabase.rpc('solicitar_aval', {
    p_tipo: 'ajuste_proprio',
    p_payload: { tipo: ajuste.tipo, valor: ajuste.valor, data: ajuste.data },
    p_resumo: resumo,
  });
  if (error) throw error;
}

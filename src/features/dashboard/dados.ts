// Acesso a dados da Tela Inicial: leituras pelas visões e funções que os outros módulos já usam
// (já filtradas pelas regras de cada pessoa) e, só para os recados internos, publicar, decidir e retirar (rpc).
import { supabase } from '../../lib/supabase';
import type {
  DemandaVisivel, DestinoDeRecado, EscopoDeRecado, LancamentoVisivel, LinhaDoRanking, PublicoDeReuniao, RecadoDoPainel, ReuniaoVisivel,
  SolicitacaoVisivel,
} from '../../types/database';

export interface DadosDoInicio {
  demandas: DemandaVisivel[];
  reunioes: ReuniaoVisivel[];
  publicos: PublicoDeReuniao[];
  ranking: LinhaDoRanking[];
  lancamentos: LancamentoVisivel[];
  solicitacoes: SolicitacaoVisivel[];
  recados: RecadoDoPainel[];
  /** Para quem a pessoa pode publicar recados; vazio = não publica. */
  destinosDeRecado: DestinoDeRecado[];
}

export async function carregarInicio(meuId: string): Promise<DadosDoInicio> {
  const [demandas, reunioes, publicos, ranking, lancamentos, solicitacoes, recados, destinos] = await Promise.all([
    supabase.from('demandas_visiveis').select('*'),
    supabase.from('reunioes_visiveis').select('*'),
    supabase.from('escopos_de_reuniao').select('*'),
    supabase.rpc('ranking'),
    supabase.from('lancamentos_visiveis').select('*').eq('pessoa_id', meuId),
    supabase.from('solicitacoes_visiveis').select('*'),
    supabase.from('recados_painel').select('*'),
    supabase.from('destinos_de_recado').select('*').order('ordem').order('nome'),
  ]);
  for (const resposta of [demandas, reunioes, publicos, ranking, lancamentos, solicitacoes, recados, destinos]) {
    if (resposta.error) throw resposta.error;
  }
  return {
    demandas: (demandas.data ?? []) as DemandaVisivel[],
    reunioes: (reunioes.data ?? []) as ReuniaoVisivel[],
    publicos: (publicos.data ?? []) as PublicoDeReuniao[],
    ranking: (ranking.data ?? []) as LinhaDoRanking[],
    lancamentos: (lancamentos.data ?? []) as LancamentoVisivel[],
    solicitacoes: (solicitacoes.data ?? []) as SolicitacaoVisivel[],
    recados: (recados.data ?? []) as RecadoDoPainel[],
    destinosDeRecado: (destinos.data ?? []) as DestinoDeRecado[],
  };
}

export async function publicarRecado(recado: {
  titulo: string; texto: string; escopo: EscopoDeRecado; escopoId: string | null; visivelAte: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('publicar_recado', {
    p_titulo: recado.titulo,
    p_texto: recado.texto,
    p_escopo: recado.escopo,
    p_escopo_id: recado.escopoId,
    p_visivel_ate: recado.visivelAte,
  });
  if (error) throw error;
}

/** Autoriza (publica e avisa o público) ou recusa um recado para toda a equipe. */
export async function decidirRecado(recadoId: string, autorizar: boolean, motivo: string | null): Promise<void> {
  const { error } = await supabase.rpc('decidir_recado', { p_id: recadoId, p_autorizar: autorizar, p_motivo: motivo });
  if (error) throw error;
}

export async function retirarRecado(recadoId: string): Promise<void> {
  const { error } = await supabase.rpc('retirar_recado', { p_id: recadoId });
  if (error) throw error;
}

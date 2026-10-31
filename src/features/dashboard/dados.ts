// Acesso a dados da Tela Inicial: só leituras pelas visões e funções que os outros módulos já usam
// (já filtradas pelas regras de cada pessoa). Nada é gravado aqui.
import { supabase } from '../../lib/supabase';
import type {
  DemandaVisivel, LancamentoVisivel, LinhaDoRanking, PublicoDeReuniao, ReuniaoVisivel, SolicitacaoVisivel,
} from '../../types/database';

export interface DadosDoInicio {
  demandas: DemandaVisivel[];
  reunioes: ReuniaoVisivel[];
  publicos: PublicoDeReuniao[];
  ranking: LinhaDoRanking[];
  lancamentos: LancamentoVisivel[];
  solicitacoes: SolicitacaoVisivel[];
}

export async function carregarInicio(meuId: string): Promise<DadosDoInicio> {
  const [demandas, reunioes, publicos, ranking, lancamentos, solicitacoes] = await Promise.all([
    supabase.from('demandas_visiveis').select('*'),
    supabase.from('reunioes_visiveis').select('*'),
    supabase.from('escopos_de_reuniao').select('*'),
    supabase.rpc('ranking'),
    supabase.from('lancamentos_visiveis').select('*').eq('pessoa_id', meuId),
    supabase.from('solicitacoes_visiveis').select('*'),
  ]);
  for (const resposta of [demandas, reunioes, publicos, ranking, lancamentos, solicitacoes]) {
    if (resposta.error) throw resposta.error;
  }
  return {
    demandas: (demandas.data ?? []) as DemandaVisivel[],
    reunioes: (reunioes.data ?? []) as ReuniaoVisivel[],
    publicos: (publicos.data ?? []) as PublicoDeReuniao[],
    ranking: (ranking.data ?? []) as LinhaDoRanking[],
    lancamentos: (lancamentos.data ?? []) as LancamentoVisivel[],
    solicitacoes: (solicitacoes.data ?? []) as SolicitacaoVisivel[],
  };
}

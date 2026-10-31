// Acesso a dados do módulo Regras: valores de pontuação (leitura aberta a quem tem cadastro), áreas e
// responsáveis, simulação de visibilidade (só a Presidência recebe linhas) e gravação pela função do banco.
import { supabase } from '../../lib/supabase';
import type { AreaDaEstrutura, LinhaDaSimulacao, PessoaDaEquipe, RegrasDePontuacao } from '../../types/database';

export interface DadosDasRegras {
  regras: RegrasDePontuacao;
  areas: AreaDaEstrutura[];
  pessoas: PessoaDaEquipe[];
  simulacao: LinhaDaSimulacao[];
}

export async function carregarRegras(): Promise<DadosDasRegras> {
  const [regras, areas, pessoas, simulacao] = await Promise.all([
    supabase.from('config').select('pontos_iniciais, entrega_no_prazo, entrega_atrasada, falta, falta_justificada, ranking_publico').maybeSingle(),
    supabase.from('areas_da_estrutura').select('*'),
    supabase.from('equipe_pessoas').select('*'),
    supabase.rpc('simulacao_de_visibilidade'),
  ]);
  for (const resposta of [regras, areas, pessoas, simulacao]) {
    if (resposta.error) throw resposta.error;
  }
  if (!regras.data) throw new Error('Configuração de pontuação não encontrada.');
  return {
    regras: regras.data as RegrasDePontuacao,
    areas: (areas.data ?? []) as AreaDaEstrutura[],
    pessoas: (pessoas.data ?? []) as PessoaDaEquipe[],
    simulacao: (simulacao.data ?? []) as LinhaDaSimulacao[],
  };
}

export async function salvarRegras(regras: RegrasDePontuacao): Promise<void> {
  const { error } = await supabase.rpc('salvar_config', {
    p_pontos_iniciais: regras.pontos_iniciais,
    p_entrega_no_prazo: regras.entrega_no_prazo,
    p_entrega_atrasada: regras.entrega_atrasada,
    p_falta: regras.falta,
    p_falta_justificada: regras.falta_justificada,
    p_ranking_publico: regras.ranking_publico,
  });
  if (error) throw error;
}

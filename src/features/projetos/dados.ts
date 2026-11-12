// Acesso a dados do módulo Projetos: leituras das visões projetos_painel e demandas_visiveis (já filtradas pelas regras de cada pessoa).
import { supabase } from '../../lib/supabase';
import type { DemandaVisivel, PessoaResumo, ProjetoDoPainel } from '../../types/database';

export async function carregarProjetos(): Promise<ProjetoDoPainel[]> {
  const { data, error } = await supabase.from('projetos_painel').select('*');
  if (error) throw error;
  return (data ?? []) as ProjetoDoPainel[];
}

export interface DadosDaMatriz {
  demandas: DemandaVisivel[];
  nomeDe: (id: string) => string;
}

/** Demandas do projeto que a pessoa enxerga, com a RACI de cada uma, e os nomes de quem aparece nelas. */
export async function carregarMatriz(projetoId: string): Promise<DadosDaMatriz> {
  const [demandas, pessoas] = await Promise.all([
    supabase.from('demandas_visiveis').select('*').eq('projeto_id', projetoId),
    supabase.from('pessoas').select('id, nome'),
  ]);
  if (demandas.error) throw demandas.error;
  if (pessoas.error) throw pessoas.error;
  const nomes = new Map(((pessoas.data ?? []) as PessoaResumo[]).map((p) => [p.id, p.nome]));
  return {
    demandas: (demandas.data ?? []) as DemandaVisivel[],
    nomeDe: (id) => nomes.get(id) ?? 'Pessoa sem cadastro',
  };
}

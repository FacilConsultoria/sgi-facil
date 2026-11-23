// Acesso a dados do módulo de Presenças: a frequência (função frequencia(), já limitada a quem a pessoa acompanha),
// as reuniões da própria pessoa com a presença e as justificativas de falta (visões e funções do 26).
import { supabase } from '../../lib/supabase';
import type { FrequenciaDaPessoa, JustificativaParaDecidir, MinhaPresenca } from '../../types/database';

export interface DadosDePresencas {
  frequencia: FrequenciaDaPessoa[];
  minhas: MinhaPresenca[];
  paraDecidir: JustificativaParaDecidir[];
}

export async function carregarPresencas(): Promise<DadosDePresencas> {
  const [frequencia, minhas, paraDecidir] = await Promise.all([
    supabase.rpc('frequencia'),
    supabase.from('minhas_presencas').select('*').order('data', { ascending: false }),
    supabase.from('justificativas_para_decidir').select('*').order('criado_em'),
  ]);
  for (const resposta of [frequencia, minhas, paraDecidir]) {
    if (resposta.error) throw resposta.error;
  }
  return {
    frequencia: (frequencia.data ?? []) as FrequenciaDaPessoa[],
    minhas: (minhas.data ?? []) as MinhaPresenca[],
    paraDecidir: (paraDecidir.data ?? []) as JustificativaParaDecidir[],
  };
}

export async function justificarMinhaFalta(reuniaoId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('justificar_minha_falta', { p_reuniao: reuniaoId, p_motivo: motivo });
  if (error) throw error;
}

export async function decidirJustificativa(id: string, aceitar: boolean, nota: string): Promise<void> {
  const { error } = await supabase.rpc('decidir_justificativa', { p_id: id, p_aceitar: aceitar, p_nota: nota || null });
  if (error) throw error;
}

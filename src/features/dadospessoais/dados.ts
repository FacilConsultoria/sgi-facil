// Acesso a dados dos dados pessoais. A leitura passa pela RLS (só a própria pessoa, a Presidente, a Assessoria de
// Presidência e a diretoria da área recebem linha)
// e a gravação só vale para quem chama (supabase.rpc salvar_meus_dados).
import { supabase } from '../../lib/supabase';
import type { DadosPessoais } from '../../types/database';
import type { DadosParaSalvar } from './regras';

/** Nulo quando a pessoa ainda não preencheu (ou quando quem consulta não pode ler). */
export async function carregarDadosDe(pessoaId: string): Promise<DadosPessoais | null> {
  const { data, error } = await supabase.from('dados_pessoais').select('*').eq('pessoa_id', pessoaId).maybeSingle();
  if (error) throw error;
  return (data ?? null) as DadosPessoais | null;
}

export async function salvarMeusDados(dados: DadosParaSalvar): Promise<void> {
  const { error } = await supabase.rpc('salvar_meus_dados', {
    p_nome_completo: dados.nomeCompleto,
    p_rga: dados.rga,
    p_cpf: dados.cpf,
    p_nascimento: dados.nascimento,
    p_genero: dados.genero,
  });
  if (error) throw error;
}

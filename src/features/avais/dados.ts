// Acesso a dados do módulo de Avais: leitura pela visão do banco (já filtrada pela RLS: cada pessoa vê
// os próprios pedidos; a Presidente e a Vice veem todos) e decisão pela função do banco.
import { supabase } from '../../lib/supabase';
import type { AvalVisivel, PessoaResumo } from '../../types/database';

export interface DadosDosAvais {
  avais: AvalVisivel[];
  nomeDe: (id: string) => string;
}

export async function carregarAvais(): Promise<DadosDosAvais> {
  const [avais, pessoas] = await Promise.all([
    supabase.from('avais_visiveis').select('*').order('criado_em', { ascending: false }),
    supabase.from('pessoas').select('id, nome'),
  ]);
  for (const resposta of [avais, pessoas]) {
    if (resposta.error) throw resposta.error;
  }
  const nomes = new Map<string, string>();
  for (const pessoa of (pessoas.data ?? []) as PessoaResumo[]) nomes.set(pessoa.id, pessoa.nome);
  return {
    avais: (avais.data ?? []) as AvalVisivel[],
    nomeDe: (id) => nomes.get(id) ?? 'Pessoa sem cadastro',
  };
}

/** Aprovar executa a ação do pedido na hora (com as regras de quem aprova); negar só registra. */
export async function decidirAval(avalId: string, aprovar: boolean, nota: string): Promise<void> {
  const { error } = await supabase.rpc('decidir_aval', { p_aval: avalId, p_aprovar: aprovar, p_nota: nota || null });
  if (error) throw error;
}

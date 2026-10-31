// Acesso a dados do módulo Projetos: uma leitura da visão projetos_painel (já filtrada pelas regras de cada pessoa).
import { supabase } from '../../lib/supabase';
import type { ProjetoDoPainel } from '../../types/database';

export async function carregarProjetos(): Promise<ProjetoDoPainel[]> {
  const { data, error } = await supabase.from('projetos_painel').select('*');
  if (error) throw error;
  return (data ?? []) as ProjetoDoPainel[];
}

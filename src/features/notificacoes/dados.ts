// Acesso a dados do sino: a leitura passa pela visão minhas_notificacoes (só as da própria pessoa)
// e marcar como lida só vale para quem chama (rpc marcar_notificacoes_lidas).
import { supabase } from '../../lib/supabase';
import type { Notificacao } from '../../types/database';

export async function carregarNotificacoes(): Promise<Notificacao[]> {
  const { data, error } = await supabase.from('minhas_notificacoes').select('*');
  if (error) throw error;
  return (data ?? []) as Notificacao[];
}

/** Sem lista, marca todas as da pessoa. */
export async function marcarComoLidas(ids: string[] | null): Promise<void> {
  const { error } = await supabase.rpc('marcar_notificacoes_lidas', { p_ids: ids });
  if (error) throw error;
}

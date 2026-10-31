// Acesso a dados do Histórico completo: leitura pela visão historico_visivel, já filtrada pela regra de
// leitura da auditoria (cada pessoa recebe só os registros do seu escopo). Somente leitura.
import { supabase } from '../../lib/supabase';
import type { RegistroDoHistorico } from '../../types/database';
import { filtroDeBusca, TAMANHO_DA_PAGINA } from './regras';

/**
 * Uma página de registros, dos mais recentes para os mais antigos. `antesDoId` continua de onde a página
 * anterior parou; `busca` filtra no banco (em tudo o que a pessoa vê, não só no que já foi carregado).
 */
export async function carregarHistorico(busca: string, antesDoId: number | null): Promise<RegistroDoHistorico[]> {
  let consulta = supabase.from('historico_visivel').select('id, em, ator, ator_nome, acao, detalhe');
  const filtro = filtroDeBusca(busca);
  if (filtro) consulta = consulta.or(filtro);
  if (antesDoId !== null) consulta = consulta.lt('id', antesDoId);
  const { data, error } = await consulta.order('id', { ascending: false }).limit(TAMANHO_DA_PAGINA);
  if (error) throw error;
  return (data ?? []) as RegistroDoHistorico[];
}

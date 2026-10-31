// Acesso a dados do módulo de Presenças: leitura pela função frequencia() do banco, que já devolve
// só as pessoas que quem consulta pode acompanhar.
import { supabase } from '../../lib/supabase';
import type { FrequenciaDaPessoa } from '../../types/database';

export async function carregarFrequencia(): Promise<FrequenciaDaPessoa[]> {
  const { data, error } = await supabase.rpc('frequencia');
  if (error) throw error;
  return (data ?? []) as FrequenciaDaPessoa[];
}

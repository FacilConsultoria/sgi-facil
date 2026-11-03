// Acesso a dados do calendário de disponibilidade. A leitura passa pela RLS (a própria pessoa e quem a enxerga pela
// hierarquia recebem a grade) e a gravação só vale para quem chama (supabase.rpc salvar_minha_disponibilidade).
import { supabase } from '../../lib/supabase';
import type { DisponibilidadeSemanal, PessoaComDisponibilidade } from '../../types/database';
import { horariosValidos, type Grades } from './regras';

export interface DadosDaDisponibilidade {
  /** Pessoas que quem consulta pode ver (inclusive ela mesma), com a marca de quem já preencheu. */
  pessoas: PessoaComDisponibilidade[];
  grades: Grades;
}

export async function carregarDisponibilidade(): Promise<DadosDaDisponibilidade> {
  const [pessoas, grades] = await Promise.all([
    supabase.from('disponibilidade_pessoas').select('*'),
    supabase.from('disponibilidade_semanal').select('*'),
  ]);
  for (const resposta of [pessoas, grades]) {
    if (resposta.error) throw resposta.error;
  }
  const mapa = new Map<string, Set<number>>();
  for (const linha of (grades.data ?? []) as DisponibilidadeSemanal[]) mapa.set(linha.pessoa_id, horariosValidos(linha.slots));
  return { pessoas: (pessoas.data ?? []) as PessoaComDisponibilidade[], grades: mapa };
}

export async function salvarMinhaDisponibilidade(horarios: ReadonlySet<number>): Promise<void> {
  const { error } = await supabase.rpc('salvar_minha_disponibilidade', { p_slots: [...horarios].sort((a, b) => a - b) });
  if (error) throw error;
}

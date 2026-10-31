// Acesso a dados do módulo Estrutura e equipe: leituras pelas visões do banco (já filtradas pelas regras de
// cada pessoa) e gravações só pelas funções do banco (supabase.rpc).
import { supabase } from '../../lib/supabase';
import type {
  AreaCadastravel, AreaDaEstrutura, CandidatoALideranca, NucleoDaEstrutura, Papel, PessoaDaEquipe,
} from '../../types/database';

export interface DadosDaEstrutura {
  areas: AreaDaEstrutura[];
  nucleos: NucleoDaEstrutura[];
  pessoas: PessoaDaEquipe[];
  /** Quem pode ser titular ou cobertura (vazio para quem não define lideranças). */
  candidatos: CandidatoALideranca[];
  /** Cargos que quem consulta pode dar no cadastro (vazio para quem não cadastra). */
  papeis: Papel[];
  /** Áreas em que quem consulta pode cadastrar (vazio para quem não cadastra). */
  areasParaCadastro: AreaCadastravel[];
}

export async function carregarEstrutura(): Promise<DadosDaEstrutura> {
  const [areas, nucleos, pessoas, candidatos, papeis, areasParaCadastro] = await Promise.all([
    supabase.from('areas_da_estrutura').select('*'),
    supabase.from('nucleos').select('id, area_id, nome, vaga, nota'),
    supabase.from('equipe_pessoas').select('*'),
    supabase.from('candidatos_a_lideranca').select('*'),
    supabase.from('papeis_cadastraveis').select('papel'),
    supabase.from('areas_cadastraveis').select('*'),
  ]);
  for (const resposta of [areas, nucleos, pessoas, candidatos, papeis, areasParaCadastro]) {
    if (resposta.error) throw resposta.error;
  }
  return {
    areas: (areas.data ?? []) as AreaDaEstrutura[],
    nucleos: (nucleos.data ?? []) as NucleoDaEstrutura[],
    pessoas: (pessoas.data ?? []) as PessoaDaEquipe[],
    candidatos: (candidatos.data ?? []) as CandidatoALideranca[],
    papeis: ((papeis.data ?? []) as { papel: Papel }[]).map((linha) => linha.papel),
    areasParaCadastro: (areasParaCadastro.data ?? []) as AreaCadastravel[],
  };
}

export interface DadosDoCadastro {
  nome: string;
  papel: Papel;
  area: string;
  /** Vazio para Presidente, Vice e diretoria. */
  nucleo: string;
  curso: string;
}

export async function cadastrarPessoa(email: string, dados: DadosDoCadastro): Promise<void> {
  const { error } = await supabase.rpc('cadastrar_pessoa', {
    p_email: email.trim(),
    p_nome: dados.nome.trim(),
    p_papel: dados.papel,
    p_area: dados.area,
    p_nucleo: dados.nucleo || null,
    p_curso: dados.curso.trim() || null,
  });
  if (error) throw error;
}

export async function atualizarPessoa(id: string, dados: DadosDoCadastro, ativo: boolean): Promise<void> {
  const { error } = await supabase.rpc('atualizar_pessoa', {
    p_id: id,
    p_nome: dados.nome.trim(),
    p_papel: dados.papel,
    p_area: dados.area,
    p_nucleo: dados.nucleo || null,
    p_curso: dados.curso.trim() || null,
    p_ativo: ativo,
  });
  if (error) throw error;
}

export async function definirLideranca(areaId: string, titular: string | null, cobertura: string | null): Promise<void> {
  const { error } = await supabase.rpc('definir_lideranca_area', { p_area: areaId, p_titular: titular, p_cobertura: cobertura });
  if (error) throw error;
}

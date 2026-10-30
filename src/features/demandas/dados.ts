// Acesso a dados do módulo de Demandas: leituras pelas visões do banco (já filtradas
// pela RLS) e gravações só pelas funções do banco (supabase.rpc), nunca direto nas tabelas.
import { supabase } from '../../lib/supabase';
import type {
  DemandaVisivel, NucleoVisivel, PessoaAtribuivel, PessoaResumo, Prioridade, ProjetoVisivel, RegistroAuditoria, StatusDemanda,
} from '../../types/database';

export interface DadosDoQuadro {
  demandas: DemandaVisivel[];
  projetos: ProjetoVisivel[];
  nucleos: NucleoVisivel[];
  atribuiveis: PessoaAtribuivel[];
  nomeDe: (id: string) => string;
}

export async function carregarQuadro(): Promise<DadosDoQuadro> {
  const [demandas, projetos, nucleos, atribuiveis, pessoas] = await Promise.all([
    supabase.from('demandas_visiveis').select('*'),
    supabase.from('projetos_visiveis').select('*').order('nome'),
    supabase.from('nucleos_visiveis').select('*').order('nome'),
    supabase.from('pessoas_atribuiveis').select('*').order('nome'),
    supabase.from('pessoas').select('id, nome'),
  ]);
  for (const resposta of [demandas, projetos, nucleos, atribuiveis, pessoas]) {
    if (resposta.error) throw resposta.error;
  }
  const nomes = new Map<string, string>();
  for (const pessoa of (pessoas.data ?? []) as PessoaResumo[]) nomes.set(pessoa.id, pessoa.nome);
  return {
    demandas: (demandas.data ?? []) as DemandaVisivel[],
    projetos: (projetos.data ?? []) as ProjetoVisivel[],
    nucleos: (nucleos.data ?? []) as NucleoVisivel[],
    atribuiveis: (atribuiveis.data ?? []) as PessoaAtribuivel[],
    nomeDe: (id) => nomes.get(id) ?? 'Pessoa sem cadastro',
  };
}

/** Alterações registradas da demanda, da mais recente para a mais antiga. */
export async function carregarHistorico(demandaId: string): Promise<RegistroAuditoria[]> {
  const { data, error } = await supabase
    .from('auditoria')
    .select('id, em, ator, acao, detalhe')
    .eq('demanda_id', demandaId)
    .order('em', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RegistroAuditoria[];
}

export interface NovaDemanda {
  projetoId: string;
  titulo: string;
  descricao: string;
  prazo: string;
  prioridade: Prioridade;
  executores: string[];
  /** Só tem efeito para a Presidência; o banco ignora para os demais. */
  restrita: boolean;
}

/** Devolve o id da demanda criada. */
export async function criarDemanda(nova: NovaDemanda): Promise<string> {
  const { data, error } = await supabase.rpc('criar_demanda', {
    p_projeto: nova.projetoId,
    p_titulo: nova.titulo,
    p_descricao: nova.descricao,
    p_prazo: nova.prazo,
    p_prioridade: nova.prioridade,
    p_executores: nova.executores,
    p_restrito: nova.restrita,
  });
  if (error) throw error;
  return data as string;
}

export interface EdicaoDeDemanda {
  titulo: string;
  descricao: string;
  status: StatusDemanda;
  prioridade: Prioridade;
  prazo: string;
  executores: string[];
  /** null mantém como está (quem não é da Presidência não altera a restrição). */
  restrita: boolean | null;
}

export async function editarDemanda(demandaId: string, edicao: EdicaoDeDemanda): Promise<void> {
  const { error } = await supabase.rpc('editar_demanda', {
    p_demanda: demandaId,
    p_titulo: edicao.titulo,
    p_descricao: edicao.descricao,
    p_status: edicao.status,
    p_prioridade: edicao.prioridade,
    p_prazo: edicao.prazo,
    p_executores: edicao.executores,
    p_restrito: edicao.restrita,
  });
  if (error) throw error;
}

export async function mudarStatus(demandaId: string, status: StatusDemanda): Promise<void> {
  const { error } = await supabase.rpc('mudar_status', { p_demanda: demandaId, p_status: status });
  if (error) throw error;
}

export interface NovoProjeto {
  nome: string;
  cliente: string;
  nucleoId: string;
  /** Só tem efeito para a Presidência; o banco ignora para os demais. */
  restrito: boolean;
}

/** Devolve o id do projeto criado. */
export async function criarProjeto(novo: NovoProjeto): Promise<string> {
  const { data, error } = await supabase.rpc('criar_projeto', {
    p_nome: novo.nome,
    p_cliente: novo.cliente,
    p_nucleo: novo.nucleoId,
    p_restrito: novo.restrito,
  });
  if (error) throw error;
  return data as string;
}

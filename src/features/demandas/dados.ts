// Acesso a dados do módulo de Demandas: leituras pelas visões do banco (já filtradas
// pela RLS) e gravações só pelas funções do banco (supabase.rpc), nunca direto nas tabelas.
import { supabase } from '../../lib/supabase';
import type {
  AlcanceDaEntrega, AprovadorPossivel, DemandaVisivel, MensagemDaDemanda, NucleoVisivel, PessoaAtribuivel, PessoaInformavel, PessoaResumo,
  Prioridade, ProjetoVisivel, RegistroAuditoria, StatusDemanda,
} from '../../types/database';

export interface DadosDoQuadro {
  demandas: DemandaVisivel[];
  projetos: ProjetoVisivel[];
  nucleos: NucleoVisivel[];
  atribuiveis: PessoaAtribuivel[];
  /** Quem pode aprovar em cada projeto onde a pessoa cria ou edita demandas (vazio para membros). */
  aprovadores: AprovadorPossivel[];
  /** Quem pode ser informado numa entrega de alcance geral (vazio para membros). */
  informaveis: PessoaInformavel[];
  nomeDe: (id: string) => string;
}

export async function carregarQuadro(): Promise<DadosDoQuadro> {
  const [demandas, projetos, nucleos, atribuiveis, pessoas, aprovadores, informaveis] = await Promise.all([
    supabase.from('demandas_visiveis').select('*'),
    supabase.from('projetos_visiveis').select('*').order('nome'),
    supabase.from('nucleos_visiveis').select('*').order('nome'),
    supabase.from('pessoas_atribuiveis').select('*').order('nome'),
    supabase.from('pessoas').select('id, nome'),
    supabase.from('aprovadores_possiveis').select('*').order('nome'),
    supabase.from('pessoas_informaveis').select('*').order('nome'),
  ]);
  for (const resposta of [demandas, projetos, nucleos, atribuiveis, pessoas, aprovadores, informaveis]) {
    if (resposta.error) throw resposta.error;
  }
  const nomes = new Map<string, string>();
  for (const pessoa of (pessoas.data ?? []) as PessoaResumo[]) nomes.set(pessoa.id, pessoa.nome);
  return {
    demandas: (demandas.data ?? []) as DemandaVisivel[],
    projetos: (projetos.data ?? []) as ProjetoVisivel[],
    nucleos: (nucleos.data ?? []) as NucleoVisivel[],
    atribuiveis: (atribuiveis.data ?? []) as PessoaAtribuivel[],
    aprovadores: (aprovadores.data ?? []) as AprovadorPossivel[],
    informaveis: (informaveis.data ?? []) as PessoaInformavel[],
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
  raci: RaciEscolhida;
}

/** A e I escolhidos no formulário (R são os executores). */
export interface RaciEscolhida {
  aprovador: string;
  alcance: AlcanceDaEntrega;
  /** Além da Presidente, que o banco inclui sozinho no alcance geral. */
  informados: string[];
}

/** Devolve o id da demanda criada. */
export async function criarDemanda(nova: NovaDemanda): Promise<string> {
  const { data, error } = await supabase.rpc('criar_demanda_raci', {
    p_projeto: nova.projetoId,
    p_titulo: nova.titulo,
    p_descricao: nova.descricao,
    p_prazo: nova.prazo,
    p_prioridade: nova.prioridade,
    p_executores: nova.executores,
    p_aprovador: nova.raci.aprovador,
    p_alcance: nova.raci.alcance,
    p_informados: nova.raci.informados,
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
  raci: RaciEscolhida;
}

export async function editarDemanda(demandaId: string, edicao: EdicaoDeDemanda): Promise<void> {
  const { error } = await supabase.rpc('editar_demanda_raci', {
    p_demanda: demandaId,
    p_titulo: edicao.titulo,
    p_descricao: edicao.descricao,
    p_status: edicao.status,
    p_prioridade: edicao.prioridade,
    p_prazo: edicao.prazo,
    p_executores: edicao.executores,
    p_aprovador: edicao.raci.aprovador,
    p_alcance: edicao.raci.alcance,
    p_informados: edicao.raci.informados,
    p_restrito: edicao.restrita,
  });
  if (error) throw error;
}

export async function mudarStatus(demandaId: string, status: StatusDemanda): Promise<void> {
  const { error } = await supabase.rpc('mudar_status', { p_demanda: demandaId, p_status: status });
  if (error) throw error;
}

// ---------- passagens da RACI ----------

/** Quem executa entrega: vai para quem aprova ou, em A/R, conclui. Devolve a etapa nova. */
export async function entregarDemanda(demandaId: string, nota: string): Promise<StatusDemanda> {
  const { data, error } = await supabase.rpc('entregar_demanda', { p_demanda: demandaId, p_nota: nota || null });
  if (error) throw error;
  return data as StatusDemanda;
}

export async function sinalizarDuvida(demandaId: string, texto: string): Promise<void> {
  const { error } = await supabase.rpc('sinalizar_duvida', { p_demanda: demandaId, p_texto: texto });
  if (error) throw error;
}

export async function responderDuvida(demandaId: string, texto: string): Promise<void> {
  const { error } = await supabase.rpc('responder_duvida', { p_demanda: demandaId, p_texto: texto });
  if (error) throw error;
}

export async function solicitarAjuste(demandaId: string, texto: string): Promise<void> {
  const { error } = await supabase.rpc('solicitar_ajuste', { p_demanda: demandaId, p_texto: texto });
  if (error) throw error;
}

export async function aprovarEntrega(demandaId: string, nota: string): Promise<void> {
  const { error } = await supabase.rpc('aprovar_entrega', { p_demanda: demandaId, p_nota: nota || null });
  if (error) throw error;
}

/** Dúvidas, respostas, ajustes e notas da demanda, da mais antiga para a mais recente. */
export async function carregarConversa(demandaId: string): Promise<MensagemDaDemanda[]> {
  const { data, error } = await supabase.from('demanda_conversa_painel').select('*').eq('demanda_id', demandaId).order('criado_em');
  if (error) throw error;
  return (data ?? []) as MensagemDaDemanda[];
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

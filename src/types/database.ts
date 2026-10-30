// Contratos das visões e tabelas do Supabase usadas pela interface.
// Fonte: supabase/01_estrutura_e_regras.sql, 03_visoes_interface.sql e 04_modulo_demandas.sql.

export type Papel = 'presidente' | 'vice' | 'diretor' | 'gerente' | 'assessor' | 'membro';
export type StatusDemanda = 'afazer' | 'andamento' | 'revisao' | 'concluida';
export type Prioridade = 'alta' | 'media' | 'baixa';
export type MotivoAcesso = 'presidencia' | 'diretoria' | 'nucleo' | 'executor' | 'excecao';

/** Linha da visão public.demandas_visiveis. Datas no formato AAAA-MM-DD. */
export interface DemandaVisivel {
  id: string;
  codigo: string;
  projeto_id: string;
  titulo: string;
  descricao: string;
  status: StatusDemanda;
  prioridade: Prioridade;
  prazo: string;
  concluida_em: string | null;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
  projeto_nome: string;
  projeto_cliente: string;
  nucleo_id: string;
  area_id: string;
  /** Restrita à Presidência (a demanda ou o projeto). */
  restrita: boolean;
  executores: string[];
  pode_gerir: boolean;
  pode_mudar_status: boolean;
  motivo_acesso: MotivoAcesso;
  nucleo_nome: string;
  /** Último dia da liberação por exceção de quem consulta. */
  excecao_ate: string | null;
}

/** Linha da visão public.projetos_visiveis. */
export interface ProjetoVisivel {
  id: string;
  nome: string;
  cliente: string;
  nucleo_id: string;
  nucleo_nome: string;
  area_id: string;
  restrito: boolean;
  ativo: boolean;
  pode_criar_demanda: boolean;
}

/** Linha da visão public.nucleos_visiveis. */
export interface NucleoVisivel {
  id: string;
  nome: string;
  area_id: string;
  vaga: boolean;
  pode_criar_projeto: boolean;
}

/** Linha da visão public.pessoas_atribuiveis. */
export interface PessoaAtribuivel {
  id: string;
  nome: string;
  papel: Papel;
  area_id: string;
  nucleo_id: string | null;
}

/** Nome de qualquer pessoa ativa ou não (tabela public.pessoas, leitura aberta a quem tem cadastro). */
export interface PessoaResumo {
  id: string;
  nome: string;
}

/** Linha da tabela public.auditoria filtrada por demanda. */
export interface RegistroAuditoria {
  id: number;
  em: string;
  ator: string | null;
  acao: string;
  detalhe: string;
}

/** Linha da visão public.meu_perfil: quem está logado e o que pode fazer. */
export interface Perfil {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  area_id: string;
  area_titulo: string;
  nucleo_id: string | null;
  nucleo_nome: string | null;
  areas_que_conduz: string[];
  /** Presidência ou Vice-Presidência: acesso irrestrito. */
  eh_presidencia: boolean;
  /** Só a Presidente: aprova pedidos de itens restritos. */
  eh_presidente: boolean;
  pode_ajustar_pontos: boolean;
  pode_cadastrar_pessoas: boolean;
  pode_editar_regras: boolean;
}

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

/** Como a pessoa enxerga um projeto: pela hierarquia, por exceção do projeto inteiro ou só pelas demandas em que atua. */
export type AcessoAoProjeto = 'integral' | 'excecao' | 'parcial';

/** Linha da visão public.projetos_painel (supabase/14_modulo_projetos.sql). Os números contam só as demandas que a pessoa enxerga. */
export interface ProjetoDoPainel {
  id: string;
  nome: string;
  cliente: string;
  nucleo_id: string;
  nucleo_nome: string;
  area_id: string;
  area_titulo: string;
  restrito: boolean;
  ativo: boolean;
  acesso: AcessoAoProjeto;
  total_demandas: number;
  concluidas: number;
  atrasadas: number;
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
  /** Só vem quando a consulta pede a coluna. */
  papel?: Papel;
}

export type EscopoReuniao = 'geral' | 'presidencia' | 'area' | 'nucleo' | 'pessoas';
export type Presenca = 'presente' | 'justificada' | 'falta';
export type OrigemRegistro = 'manual' | 'meet';

/** Linha da visão public.reunioes_visiveis (supabase/05_modulo_reunioes.sql). `hora` vem como HH:MM:SS. */
export interface ReuniaoVisivel {
  id: string;
  titulo: string;
  data: string;
  hora: string;
  escopo: EscopoReuniao;
  escopo_id: string | null;
  pauta: string;
  encerrada: boolean;
  ata: string;
  ata_por: string | null;
  ata_em: string | null;
  criado_por: string;
  criado_em: string;
  /** Organiza a reunião: edita ata, presença, transcrição e anexos. */
  pode_gerir: boolean;
  convocado: boolean;
  total_anexos: number;
  tem_transcricao: boolean;
  total_convocados: number;
  total_faltas: number;
  /** Organiza, ainda não encerrou e a data já chegou. */
  pode_encerrar: boolean;
  /** Reunião aberta: quem organiza. Encerrada: Presidência (incluindo a Assessoria) e diretoria que organiza. */
  pode_excluir: boolean;
  /** Presidente ou Vice: justificam a falta de diretoria sem pedir aval. */
  pode_justificar_diretoria: boolean;
}

export type StatusDeSolicitacao = 'pendente' | 'aprovada' | 'negada' | 'revogada';
/** Igual ao status, mais "expirada" (aprovada com a validade vencida; calculado pelo banco). */
export type SituacaoDeSolicitacao = StatusDeSolicitacao | 'expirada';
export type AlvoDeSolicitacao = 'projeto' | 'demanda';

/** Linha da visão public.solicitacoes_visiveis (supabase/03 e 08): pedido de acesso por exceção. Datas AAAA-MM-DD. */
export interface SolicitacaoVisivel {
  id: string;
  solicitante: string;
  beneficiario: string;
  alvo: AlvoDeSolicitacao;
  projeto_id: string | null;
  demanda_id: string | null;
  justificativa: string;
  valido_ate: string;
  status: StatusDeSolicitacao;
  decidido_por: string | null;
  decidido_em: string | null;
  nota: string | null;
  revogado_por: string | null;
  revogado_em: string | null;
  criado_em: string;
  situacao: SituacaoDeSolicitacao;
  area_id: string;
  /** Item restrito à Presidência: só a Presidente aprova. */
  alvo_restrito: boolean;
  pode_aprovar: boolean;
  pode_revogar: boolean;
  /** O que foi pedido: "Projeto · Cliente" ou "COD-001 · Título da demanda". */
  alvo_nome: string;
  /** Assessoria de Presidência: pode pedir aval da Presidente ou da Vice para decidir o pedido. */
  pode_pedir_aval: boolean;
}

/** Linha da função public.projetos_solicitaveis(pessoa). */
export interface ProjetoSolicitavel {
  id: string;
  nome: string;
  cliente: string;
  nucleo_nome: string;
  area_id: string;
}

export type TipoDeAval ='ajuste_proprio' | 'decidir_solicitacao' | 'justificar_falta';
export type StatusDeAval = 'pendente' | 'aprovado' | 'negado';

/** Linha da visão public.avais_visiveis (supabase/07_assessoria_aval_publico_exclusao.sql). */
export interface AvalVisivel {
  id: string;
  tipo: TipoDeAval;
  solicitante: string;
  resumo: string;
  /** O que será executado se aprovarem; o formato depende do tipo. */
  payload: Record<string, unknown>;
  status: StatusDeAval;
  decidido_por: string | null;
  decidido_em: string | null;
  nota: string | null;
  criado_em: string;
  /** Presidente ou Vice, em aval pendente que não é seu. */
  pode_decidir: boolean;
}

/** Linha da visão public.escopos_de_reuniao: um público possível, com o nome e se a pessoa pode agendar para ele. */
export interface PublicoDeReuniao {
  escopo: EscopoReuniao;
  escopo_id: string | null;
  titulo: string;
  pode_criar: boolean;
  total_convocados: number;
}

/** Linha da tabela public.reuniao_convocados. `presenca` nulo = sem registro. */
export interface ConvocadoDaReuniao {
  pessoa_id: string;
  presenca: Presenca | null;
}

/** Linha da tabela public.transcricoes. `reuniao_id` nulo = recebida e ainda sem reunião. */
export interface TranscricaoDaReuniao {
  id: string;
  reuniao_id: string | null;
  texto: string;
  origem: OrigemRegistro;
  titulo_origem: string | null;
  inicio_origem: string | null;
  registrado_por: string | null;
  recebida_em: string;
}

/** Linha da tabela public.anexos. O arquivo fica no bucket "anexos", em `caminho`. */
export interface AnexoDaReuniao {
  id: string;
  reuniao_id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  caminho: string;
  origem: OrigemRegistro;
  enviado_por: string | null;
  enviado_em: string;
}

/** Linha da tabela public.auditoria filtrada por demanda ou reunião. */
export interface RegistroAuditoria {
  id: number;
  em: string;
  ator: string | null;
  acao: string;
  detalhe: string;
}

export type TipoDeLancamento = 'demanda' | 'evento' | 'falta' | 'ajuste';

/** Linha da visão public.pontuacao_pessoas (supabase/09_modulo_pontuacao.sql): pessoa cuja pontuação detalhada quem consulta pode ver. */
export interface PessoaComPontuacao {
  id: string;
  nome: string;
  papel: Papel;
  area_id: string;
  nucleo_id: string | null;
  curso: string | null;
  /** Nome do núcleo ou, sem núcleo, da área. */
  setor: string;
  /** Pontos iniciais mais os lançamentos que não foram desconsiderados. */
  pontos: number;
  entregas: number;
  faltas: number;
  /** Faltas lançadas sem perda de pontos. */
  justificadas: number;
  /** Projetos com demanda em aberto que quem consulta pode ver. */
  projetos_ativos: string[];
  /** Quantos outros projetos ativos a pessoa tem, sem o nome (quem consulta não os vê). */
  projetos_ocultos: number;
  /** Lança ajuste ou evento para esta pessoa e desconsidera lançamentos dela. */
  pode_ajustar: boolean;
  /** Assessoria de Presidência olhando a própria pontuação: ajustar depende do aval da Presidente ou da Vice. */
  pode_pedir_aval: boolean;
}

/** Linha da visão public.lancamentos_visiveis. `data` no formato AAAA-MM-DD. */
export interface LancamentoVisivel {
  id: string;
  pessoa_id: string;
  tipo: TipoDeLancamento;
  descricao: string;
  data: string;
  valor: number;
  demanda_id: string | null;
  reuniao_id: string | null;
  criado_por: string | null;
  criado_em: string;
  desconsiderado_por: string | null;
  desconsiderado_em: string | null;
  motivo_desconsideracao: string | null;
  /** Só vêm quando quem consulta pode ver a demanda. */
  demanda_codigo: string | null;
  demanda_titulo: string | null;
  pode_desconsiderar: boolean;
}

/** Linha da função public.ranking(): só as pessoas que quem consulta pode ver, do maior para o menor saldo. */
export interface LinhaDoRanking {
  pessoa_id: string;
  nome: string;
  setor: string;
  pontos: number;
  entregas: number;
  faltas: number;
}

/** Linha da função public.frequencia() (supabase/10_modulo_presencas.sql): presença nas reuniões encerradas, por pessoa. */
export interface FrequenciaDaPessoa {
  pessoa_id: string;
  nome: string;
  setor: string;
  /** Reuniões encerradas que convocaram a pessoa. */
  convocacoes: number;
  presencas: number;
  justificadas: number;
  faltas: number;
}

/** Parte da tabela public.config que a tela de pontuação mostra. */
export interface ConfigDePontuacao {
  pontos_iniciais: number;
  ranking_publico: boolean;
}

/** Linha da visão public.equipe_pessoas (supabase/11_modulo_equipe.sql). E-mail e pessoas desativadas só vêm para quem cadastra. */
export interface PessoaDaEquipe {
  id: string;
  nome: string;
  papel: Papel;
  area_id: string;
  nucleo_id: string | null;
  curso: string | null;
  ativo: boolean;
  email: string | null;
  /** Quem consulta pode alterar este cadastro. */
  pode_editar: boolean;
}

/** Linha da visão public.areas_da_estrutura: Presidência e diretorias, com titular e cobertura (ids de pessoas). */
export interface AreaDaEstrutura {
  id: string;
  titulo: string;
  sigla: string;
  titular: string | null;
  /** Quem responde enquanto a área está sem titular. */
  cobertura: string | null;
  nota: string | null;
  pode_definir_lideranca: boolean;
  area_da_presidencia: boolean;
}

/** Linha da tabela public.nucleos. */
export interface NucleoDaEstrutura {
  id: string;
  area_id: string;
  nome: string;
  /** Liderança do núcleo em aberto. */
  vaga: boolean;
  nota: string | null;
}

/** Linha da visão public.areas_cadastraveis: áreas em que quem consulta pode cadastrar pessoas. */
export interface AreaCadastravel {
  id: string;
  titulo: string;
}

/** Linha da visão public.candidatos_a_lideranca: quem pode ser titular ou cobertura de uma área. */
export interface CandidatoALideranca {
  id: string;
  nome: string;
  papel: Papel;
}

/** Linha da visão public.historico_visivel (supabase/12_modulo_historico.sql): um registro de auditoria que quem consulta pode ver. */
export interface RegistroDoHistorico {
  id: number;
  em: string;
  /** Nulo = integração automática. */
  ator: string | null;
  ator_nome: string | null;
  acao: string;
  detalhe: string;
}

/** Linha da tabela public.config: valores de pontuação e visibilidade do ranking (a parte que a tela Regras edita). */
export interface RegrasDePontuacao {
  pontos_iniciais: number;
  entrega_no_prazo: number;
  entrega_atrasada: number;
  falta: number;
  falta_justificada: number;
  ranking_publico: boolean;
}

/** Linha da função public.simulacao_de_visibilidade() (supabase/13_modulo_regras.sql); só a Presidência recebe linhas. */
export interface LinhaDaSimulacao {
  pessoa_id: string;
  nome: string;
  papel: Papel;
  setor: string;
  demandas_visiveis: number;
  /** Demandas que a pessoa só vê por uma liberação de acesso ativa. */
  por_excecao: number;
  pontuacoes_visiveis: number;
  total_demandas: number;
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
  /** A pessoa ainda não preencheu os dados pessoais (supabase/15_dados_pessoais.sql). */
  dados_pendentes: boolean;
}

/** Linha da tabela public.disponibilidade_semanal (supabase/17_disponibilidade.sql). Horário = dia * 24 + hora (segunda = dia 0). */
export interface DisponibilidadeSemanal {
  pessoa_id: string;
  slots: number[];
  atualizado_em: string;
}

/** Linha da visão public.disponibilidade_pessoas: pessoas cuja grade quem consulta pode ver, e se já preencheram. */
export interface PessoaComDisponibilidade {
  id: string;
  nome: string;
  setor: string;
  preenchida: boolean;
  atualizado_em: string | null;
}

export type GeneroInformado = 'feminino' | 'masculino' | 'outro' | 'nao_informar';

/** Linha da tabela public.dados_pessoais: só a própria pessoa e a Presidente leem. CPF e RGA vêm sem pontuação. */
export interface DadosPessoais {
  pessoa_id: string;
  nome_completo: string;
  rga: string;
  cpf: string;
  /** AAAA-MM-DD. */
  nascimento: string;
  genero: GeneroInformado;
  criado_em: string;
  atualizado_em: string;
}

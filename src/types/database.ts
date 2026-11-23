// Contratos das visões e tabelas do Supabase usadas pela interface.
// Fonte: supabase/01_estrutura_e_regras.sql, 03_visoes_interface.sql e 04_modulo_demandas.sql.

export type Papel = 'presidente' | 'vice' | 'diretor' | 'gerente' | 'assessor' | 'membro' | 'trainee';
export type StatusDemanda = 'afazer' | 'andamento' | 'revisao' | 'concluida';
export type Prioridade = 'alta' | 'media' | 'baixa';
export type MotivoAcesso = 'presidencia' | 'diretoria' | 'nucleo' | 'executor' | 'aprovador' | 'informado' | 'excecao';
/** Alcance da entrega na RACI: só uma parte do time ou a Fácil como um todo (informa a Presidência). */
export type AlcanceDaEntrega = 'parte' | 'geral';
/** De quem é a caixa agora: de quem executa (R), de quem aprova (A) ou de ninguém (concluída). */
export type ComQuem = 'executores' | 'aprovador' | 'ninguem';

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
  // RACI (supabase/23_raci.sql). Os indicadores pode_* e na_minha_caixa vêm calculados pelo banco.
  /** Quem aprova (A). Nulo só em demandas antigas sem diretoria nem Presidente para sugerir. */
  aprovador_id: string | null;
  alcance: AlcanceDaEntrega;
  /** Há uma dúvida de quem executa esperando resposta de quem aprova. */
  duvida_aberta: boolean;
  /** Quem é informado (I) na conclusão. */
  informados: string[];
  /** Um só executor, que também aprova: concluir encerra direto. */
  eh_ar: boolean;
  com_quem: ComQuem;
  pode_entregar: boolean;
  pode_sinalizar_duvida: boolean;
  pode_responder_duvida: boolean;
  /** Aprovar ou pedir ajuste. */
  pode_avaliar: boolean;
  /** A demanda espera uma ação de quem consulta. */
  na_minha_caixa: boolean;
}

/** Linha da visão public.aprovadores_possiveis: quem pode aprovar as entregas de um projeto. */
export interface AprovadorPossivel {
  projeto_id: string;
  pessoa_id: string;
  nome: string;
  papel: Papel;
  /** Só a Presidência aprova demandas restritas. */
  da_presidencia: boolean;
  /** A diretoria da área (ou, sem ela, a Presidente): já vem marcada no formulário. */
  sugerido: boolean;
}

/** Linha da visão public.pessoas_informaveis: quem pode ser informado (I) numa entrega de alcance geral. */
export interface PessoaInformavel {
  id: string;
  nome: string;
  papel: Papel;
  area_id: string;
  /** A Presidente: entra sem precisar escolher. */
  automatico: boolean;
  da_presidencia: boolean;
}

export type TipoDeMensagemDaDemanda = 'entrega' | 'duvida' | 'resposta' | 'ajuste' | 'aprovacao';

/** Linha da visão public.demanda_conversa_painel: o que foi dito em cada passagem da demanda. */
export interface MensagemDaDemanda {
  id: string;
  demanda_id: string;
  autor_id: string;
  autor_nome: string;
  tipo: TipoDeMensagemDaDemanda;
  texto: string;
  criado_em: string;
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
  /** Quem consulta lê os dados pessoais desta pessoa (supabase/22_dados_pessoais_diretorias.sql). */
  pode_ver_dados: boolean;
  /** Se a pessoa já preencheu os dados pessoais; nulo para quem não pode ver. */
  dados_preenchidos: boolean | null;
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
  /** Lê os dados pessoais das outras pessoas: a Presidente e a Assessoria de Presidência (supabase/21_dados_pessoais_assessoria.sql). */
  pode_ver_dados_pessoais: boolean;
  /** Há outra pessoa ativa cujos dados pessoais quem consulta lê (Presidente, Assessoria e diretorias com time). */
  ve_dados_do_time: boolean;
}

/** "autorizacao": recado para toda a equipe aguardando a autorização de quem consulta (supabase/19_recados_autorizacao_e_prazo.sql). */
export type TipoDeNotificacao = 'atraso' | 'atribuicao' | 'recado' | 'autorizacao' | 'sugestao' | 'raci' | 'justificativa';

/** Linha da visão public.minhas_notificacoes (supabase/18_recados_e_notificacoes.sql): o que o sino mostra. */
export interface Notificacao {
  /** Identifica a linha na lista; as de atraso não têm id gravado. */
  chave: string;
  /** Só as gravadas (atribuição e recado) têm id e podem ser marcadas como lidas. */
  id: string | null;
  tipo: TipoDeNotificacao;
  /** Título da demanda ou do recado. */
  titulo: string;
  codigo: string | null;
  prazo: string | null;
  autor_nome: string | null;
  demanda_id: string | null;
  recado_id: string | null;
  em: string;
  /** Sugestão de quem consulta que recebeu comentário ou resposta (supabase/20_sugestoes.sql). */
  sugestao_id: string | null;
  /** "Novo comentário de Camila" ou "Situação: Planejada", nas sugestões. */
  detalhe: string | null;
}

export type TipoDeSugestao = 'melhoria' | 'bug' | 'outro';
export type SituacaoDaSugestao = 'aberta' | 'em_analise' | 'planejada' | 'feita' | 'recusada';

/** Linha da visão public.sugestoes_painel (supabase/20_sugestoes.sql). */
export interface SugestaoDoPainel {
  id: string;
  tipo: TipoDeSugestao;
  titulo: string;
  descricao: string;
  situacao: SituacaoDaSugestao;
  resposta: string | null;
  autor_id: string;
  autor_nome: string;
  criado_em: string;
  respondido_em: string | null;
  respondido_por_nome: string | null;
  apoios: number;
  /** Quem consulta já apoia esta sugestão. */
  apoiei: boolean;
  comentarios: number;
  /** Presidência: pode mudar a situação e responder. */
  pode_responder: boolean;
}

/** Linha da visão public.sugestao_comentarios_painel. */
export interface ComentarioDeSugestao {
  id: string;
  sugestao_id: string;
  autor_id: string;
  autor_nome: string;
  texto: string;
  criado_em: string;
}

export type EscopoDeRecado = 'todos' | 'area' | 'nucleo';

/** Recado para toda a equipe pedido por diretoria fica "pendente" até a Presidência decidir. */
export type SituacaoDoRecado = 'pendente' | 'publicado' | 'recusado';

/** Linha da visão public.recados_painel (o banco já tira os retirados e os com prazo vencido). */
export interface RecadoDoPainel {
  id: string;
  titulo: string;
  texto: string;
  escopo: EscopoDeRecado;
  escopo_id: string | null;
  autor_id: string;
  autor_nome: string;
  publico: string;
  criado_em: string;
  pode_retirar: boolean;
  situacao: SituacaoDoRecado;
  /** Último dia em que o recado aparece; nulo = sem prazo. */
  visivel_ate: string | null;
  publicado_em: string | null;
  motivo_recusa: string | null;
  /** Quem consulta pode autorizar ou recusar este pedido. */
  pode_autorizar: boolean;
}

/** Linha da visão public.destinos_de_recado: para quem a pessoa pode publicar. */
export interface DestinoDeRecado {
  escopo: EscopoDeRecado;
  escopo_id: string | null;
  nome: string;
  ordem: number;
  /** O recado vai primeiro para a autorização da Presidência (toda a equipe, pedido por diretoria). */
  precisa_autorizacao: boolean;
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

/**
 * Linha da tabela public.dados_pessoais: leem a própria pessoa, a Presidente, a Assessoria de Presidência e a diretoria
 * da área da pessoa. CPF e RGA vêm sem pontuação.
 */
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

// ---------- justificativas de falta, documentos (supabase/26_justificativas_trainee_documentos.sql) ----------

export type SituacaoDaJustificativa = 'pendente' | 'aceita' | 'recusada';

/** Linha da visão public.minhas_presencas: cada reunião de quem consulta, com a presença e a última justificativa. */
export interface MinhaPresenca {
  reuniao_id: string;
  titulo: string;
  data: string;
  hora: string;
  encerrada: boolean;
  /** Nulo enquanto quem organiza não registrou. */
  presenca: Presenca | null;
  justificativa: SituacaoDaJustificativa | null;
  motivo: string | null;
  nota_da_decisao: string | null;
  pode_justificar: boolean;
}

/** Linha da visão public.justificativas_para_decidir. */
export interface JustificativaParaDecidir {
  id: string;
  reuniao_id: string;
  titulo: string;
  data: string;
  encerrada: boolean;
  pessoa_id: string;
  pessoa_nome: string;
  motivo: string;
  criado_em: string;
}

export type CategoriaDeDocumento = 'estatuto' | 'relatorio' | 'regimento' | 'ata' | 'modelo' | 'outro';

/** Linha da visão public.documentos_painel. */
export interface DocumentoDoPainel {
  id: string;
  titulo: string;
  categoria: CategoriaDeDocumento;
  descricao: string;
  caminho: string;
  nome_arquivo: string;
  tipo: string;
  tamanho: number;
  enviado_em: string;
  enviado_por_nome: string | null;
  pode_excluir: boolean;
}
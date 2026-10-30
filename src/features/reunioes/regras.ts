// Regras de apresentação do módulo de Reuniões e atas. Funções puras, sem acesso a dados.
// Permissões não são calculadas aqui: chegam prontas das visões do banco
// (pode_gerir, pode_encerrar, pode_criar) e só são lidas.
import { horaCurta } from '../../lib/datas';
import { plural } from '../../lib/texto';
import type {
  ConvocadoDaReuniao, EscopoReuniao, OrigemRegistro, Presenca, PublicoDeReuniao, ReuniaoVisivel,
} from '../../types/database';

export const OPCOES_DE_PRESENCA: readonly { id: Presenca; nome: string }[] = [
  { id: 'presente', nome: 'Presente' },
  { id: 'justificada', nome: 'Falta justificada' },
  { id: 'falta', nome: 'Falta' },
];

export const NOME_DA_PRESENCA: Record<Presenca, string> = { presente: 'Presente', justificada: 'Falta justificada', falta: 'Falta' };

export const NOME_DA_ORIGEM: Record<OrigemRegistro, string> = { manual: 'Envio manual', meet: 'Google Meet' };

/** O bucket de arquivos aceita até 50 MB por arquivo (supabase/01_estrutura_e_regras.sql). */
export const LIMITE_DO_ANEXO_EM_BYTES = 50 * 1024 * 1024;

/** O banco recusa transcrições com menos que isso (public.salvar_transcricao). */
export const MINIMO_DA_TRANSCRICAO = 30;

// ---------- públicos ----------

export function chaveDoPublico(escopo: EscopoReuniao, escopoId: string | null): string {
  return `${escopo}:${escopoId ?? ''}`;
}

/** Nome do público de uma reunião, pelas linhas da visão escopos_de_reuniao. */
export function nomeDoPublico(reuniao: Pick<ReuniaoVisivel, 'escopo' | 'escopo_id'>, publicos: readonly PublicoDeReuniao[]): string {
  const chave = chaveDoPublico(reuniao.escopo, reuniao.escopo_id);
  return publicos.find((p) => chaveDoPublico(p.escopo, p.escopo_id) === chave)?.titulo ?? 'Público não encontrado';
}

export interface GrupoDePublicos {
  titulo: string;
  publicos: PublicoDeReuniao[];
}

/** Públicos em que a pessoa pode agendar, agrupados para a lista de escolha. */
export function agruparPublicosParaAgendar(publicos: readonly PublicoDeReuniao[]): GrupoDePublicos[] {
  const disponiveis = publicos.filter((p) => p.pode_criar);
  const porTitulo = (a: PublicoDeReuniao, b: PublicoDeReuniao): number => a.titulo.localeCompare(b.titulo, 'pt-BR');
  const gerais = ['geral', 'presidencia']
    .map((escopo) => disponiveis.find((p) => p.escopo === escopo))
    .filter((p): p is PublicoDeReuniao => p !== undefined);
  return [
    { titulo: 'Toda a Fácil', publicos: gerais },
    { titulo: 'Diretorias', publicos: disponiveis.filter((p) => p.escopo === 'area').sort(porTitulo) },
    { titulo: 'Núcleos', publicos: disponiveis.filter((p) => p.escopo === 'nucleo').sort(porTitulo) },
    { titulo: 'Pessoas específicas', publicos: disponiveis.filter((p) => p.escopo === 'pessoas') },
  ].filter((grupo) => grupo.publicos.length > 0);
}

/** Público em que o convite é feito pessoa a pessoa, em vez de por diretoria ou núcleo. */
export function ehPublicoDePessoas(chave: string): boolean {
  return chave === chaveDoPublico('pessoas', null);
}

// ---------- lista ----------

export type SituacaoDaReuniao = 'encerrada' | 'pendente' | 'agendada';

/** Pendente = já passou do dia e ainda falta encerrar (presença e faltas). */
export function situacaoDaReuniao(reuniao: Pick<ReuniaoVisivel, 'encerrada' | 'data'>, hoje: string): SituacaoDaReuniao {
  if (reuniao.encerrada) return 'encerrada';
  return reuniao.data < hoje ? 'pendente' : 'agendada';
}

const porDataEHora = (a: ReuniaoVisivel, b: ReuniaoVisivel): number => (a.data + a.hora).localeCompare(b.data + b.hora);

/** Abertas: pendentes e próximas, da mais antiga à mais próxima. Encerradas: da mais recente para trás. */
export function separarReunioes(reunioes: readonly ReuniaoVisivel[]): { abertas: ReuniaoVisivel[]; encerradas: ReuniaoVisivel[] } {
  return {
    abertas: reunioes.filter((r) => !r.encerrada).sort(porDataEHora),
    encerradas: reunioes.filter((r) => r.encerrada).sort((a, b) => porDataEHora(b, a)),
  };
}

/** Linha de detalhes da lista: "19:00 · Marketing · Diretoria Comercial · 3 convocados · 1 falta". */
export function descreverReuniao(reuniao: ReuniaoVisivel, nomePublico: string): string {
  const partes = [horaCurta(reuniao.hora), nomePublico, plural(reuniao.total_convocados, 'convocado', 'convocados')];
  if (reuniao.encerrada) partes.push(plural(reuniao.total_faltas, 'falta', 'faltas'));
  if (reuniao.total_anexos > 0) partes.push(plural(reuniao.total_anexos, 'anexo', 'anexos'));
  if (reuniao.tem_transcricao) partes.push('transcrição');
  return partes.join(' · ');
}

// ---------- presença ----------

export interface ContagemDePresenca {
  presente: number;
  justificada: number;
  falta: number;
  semRegistro: number;
}

export function contarPresencas(convocados: readonly ConvocadoDaReuniao[]): ContagemDePresenca {
  const contagem: ContagemDePresenca = { presente: 0, justificada: 0, falta: 0, semRegistro: 0 };
  for (const convocado of convocados) {
    if (convocado.presenca === null) contagem.semRegistro += 1;
    else contagem[convocado.presenca] += 1;
  }
  return contagem;
}

/** Formato esperado por public.salvar_presencas: { "<pessoa_id>": "presente" | "justificada" | "falta" | "" }. */
export function presencasParaEnvio(selecoes: ReadonlyMap<string, Presenca | ''>): Record<string, string> {
  return Object.fromEntries(selecoes);
}

export interface OpcaoDePresenca {
  id: Presenca;
  nome: string;
  /** Aparece, mas não pode ser escolhida (falta de diretoria só é justificada com aval). */
  bloqueada: boolean;
}

/**
 * Opções da lista de presença de uma pessoa. A falta de diretor só vira "justificada" com aval da
 * Presidente ou da Vice; quem não é um deles vê a opção bloqueada, salvo se o aval já foi dado.
 */
export function opcoesDePresenca(ehDiretor: boolean, podeJustificarDiretoria: boolean, atual: Presenca | null): OpcaoDePresenca[] {
  return OPCOES_DE_PRESENCA.map((opcao) => {
    const bloqueada = opcao.id === 'justificada' && ehDiretor && !podeJustificarDiretoria && atual !== 'justificada';
    return { ...opcao, bloqueada, nome: bloqueada ? `${opcao.nome} (precisa de aval)` : opcao.nome };
  });
}

/** Mostra "Pedir aval" quando a falta de um diretor já está salva e quem organiza não pode justificá-la sozinho. */
export function podePedirAvalDeJustificativa(ehDiretor: boolean, podeJustificarDiretoria: boolean, presencaSalva: Presenca | null): boolean {
  return ehDiretor && !podeJustificarDiretoria && presencaSalva === 'falta';
}

export function validarMotivoDoAval(motivo: string): string | null {
  return motivo.trim().length < 10 ? 'Explique o motivo em pelo menos 10 caracteres.' : null;
}

/** Texto lido por quem decide o aval (o banco exige pelo menos 15 caracteres). */
export function resumoDoPedidoDeJustificativa(nome: string, tituloDaReuniao: string, motivo: string): string {
  return `Justificar a falta de ${nome} na reunião “${tituloDaReuniao}”: ${motivo.trim()}`;
}

/** Exclusão de reunião encerrada exige o motivo, que fica registrado nos pontos desconsiderados. */
export function validarExclusao(reuniaoEncerrada: boolean, motivo: string): string | null {
  return reuniaoEncerrada && motivo.trim().length < 10 ? 'Escreva o motivo da exclusão (mínimo 10 caracteres).' : null;
}

/** Mensagem do banco para o encerramento sem todos marcados, antecipada na tela. */
export function validarPresencasParaEncerrar(selecoes: ReadonlyMap<string, Presenca | ''>): string | null {
  const semRegistro = [...selecoes.values()].filter((valor) => valor === '').length;
  return semRegistro > 0 ? `Marque a presença de todos (${semRegistro} sem registro).` : null;
}

// ---------- formulários ----------

export interface CamposDaReuniao {
  titulo: string;
  data: string;
  hora: string;
  publico: string;
  /** Pessoas marcadas, quando o público é "pessoas escolhidas". */
  pessoasEscolhidas?: number;
}

/** Checagem antes de enviar, com as mesmas mensagens do banco (que confere de novo). */
export function validarReuniao(campos: CamposDaReuniao): string | null {
  if (!campos.titulo.trim()) return 'Dê um título à reunião.';
  if (!campos.data || !campos.hora) return 'Informe data e horário.';
  if (!campos.publico) return 'Escolha um público da lista.';
  if (ehPublicoDePessoas(campos.publico) && (campos.pessoasEscolhidas ?? 0) === 0) return 'Escolha pelo menos uma pessoa para convocar.';
  return null;
}

export function validarTranscricao(texto: string): string | null {
  return texto.trim().length < MINIMO_DA_TRANSCRICAO
    ? `Cole a transcrição completa (mínimo ${MINIMO_DA_TRANSCRICAO} caracteres).`
    : null;
}

// ---------- anexos ----------

/** "1,5 MB", "320 KB" ou "900 B". */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Sigla do tipo para o selo do arquivo: "PDF", "XLSX"; sem extensão curta, usa o tipo MIME. */
export function extensaoDoArquivo(nome: string, tipo: string): string {
  const extensao = nome.includes('.') ? (nome.split('.').pop() ?? '') : '';
  if (extensao && extensao.length <= 4) return extensao.toUpperCase();
  return (tipo.split('/')[1] ?? 'arq').slice(0, 4).toUpperCase();
}

/** Nome aceito pelo armazenamento: sem acentos nem símbolos, até 100 caracteres, mantendo a extensão. */
export function nomeSeguroDeArquivo(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+\./g, '.')
    .replace(/^[_.]+|_+$/g, '')
    .slice(-100);
  return base || 'arquivo';
}

/** Caminho no bucket: a pasta é o id da reunião (as regras de acesso do banco dependem disso). */
export function caminhoDoAnexo(reuniaoId: string, nome: string, identificador: string): string {
  return `${reuniaoId}/${identificador}-${nomeSeguroDeArquivo(nome)}`;
}

export function validarArquivo(arquivo: { name: string; size: number }): string | null {
  if (arquivo.size === 0) return `“${arquivo.name}” está vazio.`;
  if (arquivo.size > LIMITE_DO_ANEXO_EM_BYTES) return `“${arquivo.name}” passa de ${formatarTamanho(LIMITE_DO_ANEXO_EM_BYTES)}.`;
  return null;
}

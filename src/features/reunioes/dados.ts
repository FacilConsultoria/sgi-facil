// Acesso a dados do módulo de Reuniões e atas: leituras pelas visões e tabelas (já filtradas pela RLS)
// e gravações só pelas funções do banco (supabase.rpc). Arquivos vão para o bucket privado "anexos".
import { registrarErro } from '../../lib/erros';
import { supabase } from '../../lib/supabase';
import type {
  AnexoDaReuniao, ConvocadoDaReuniao, EscopoReuniao, PessoaResumo, PublicoDeReuniao, RegistroAuditoria, ReuniaoVisivel,
  TranscricaoDaReuniao,
} from '../../types/database';
import { caminhoDoAnexo } from './regras';

const BUCKET_DE_ANEXOS = 'anexos';
const COLUNAS_DA_TRANSCRICAO = 'id, reuniao_id, texto, origem, titulo_origem, inicio_origem, registrado_por, recebida_em';

export interface DadosDasReunioes {
  reunioes: ReuniaoVisivel[];
  publicos: PublicoDeReuniao[];
  /** Transcrições recebidas que ainda não foram ligadas a uma reunião (só Presidência e Assessoria veem). */
  semVinculo: TranscricaoDaReuniao[];
  nomeDe: (id: string) => string;
}

export async function carregarReunioes(): Promise<DadosDasReunioes> {
  const [reunioes, publicos, semVinculo, pessoas] = await Promise.all([
    supabase.from('reunioes_visiveis').select('*'),
    supabase.from('escopos_de_reuniao').select('*'),
    supabase.from('transcricoes').select(COLUNAS_DA_TRANSCRICAO).is('reuniao_id', null).order('recebida_em', { ascending: false }),
    supabase.from('pessoas').select('id, nome'),
  ]);
  for (const resposta of [reunioes, publicos, semVinculo, pessoas]) {
    if (resposta.error) throw resposta.error;
  }
  const nomes = new Map<string, string>();
  for (const pessoa of (pessoas.data ?? []) as PessoaResumo[]) nomes.set(pessoa.id, pessoa.nome);
  return {
    reunioes: (reunioes.data ?? []) as ReuniaoVisivel[],
    publicos: (publicos.data ?? []) as PublicoDeReuniao[],
    semVinculo: (semVinculo.data ?? []) as TranscricaoDaReuniao[],
    nomeDe: (id) => nomes.get(id) ?? 'Pessoa sem cadastro',
  };
}

/** Uma reunião atualizada; nulo se não existir mais ou se a pessoa deixou de poder vê-la. */
export async function carregarReuniao(reuniaoId: string): Promise<ReuniaoVisivel | null> {
  const { data, error } = await supabase.from('reunioes_visiveis').select('*').eq('id', reuniaoId).maybeSingle();
  if (error) throw error;
  return (data ?? null) as ReuniaoVisivel | null;
}

export async function carregarConvocados(reuniaoId: string): Promise<ConvocadoDaReuniao[]> {
  const { data, error } = await supabase.from('reuniao_convocados').select('pessoa_id, presenca').eq('reuniao_id', reuniaoId);
  if (error) throw error;
  return (data ?? []) as ConvocadoDaReuniao[];
}

export async function carregarTranscricao(reuniaoId: string): Promise<TranscricaoDaReuniao | null> {
  const { data, error } = await supabase.from('transcricoes').select(COLUNAS_DA_TRANSCRICAO).eq('reuniao_id', reuniaoId).maybeSingle();
  if (error) throw error;
  return (data ?? null) as TranscricaoDaReuniao | null;
}

export async function carregarAnexos(reuniaoId: string): Promise<AnexoDaReuniao[]> {
  const { data, error } = await supabase
    .from('anexos')
    .select('id, reuniao_id, nome, tipo, tamanho, caminho, origem, enviado_por, enviado_em')
    .eq('reuniao_id', reuniaoId)
    .order('enviado_em');
  if (error) throw error;
  return (data ?? []) as AnexoDaReuniao[];
}

/** Alterações registradas da reunião, da mais recente para a mais antiga. */
export async function carregarHistoricoDaReuniao(reuniaoId: string): Promise<RegistroAuditoria[]> {
  const { data, error } = await supabase
    .from('auditoria')
    .select('id, em, ator, acao, detalhe')
    .eq('reuniao_id', reuniaoId)
    .order('em', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RegistroAuditoria[];
}

export interface NovaReuniao {
  titulo: string;
  data: string;
  hora: string;
  escopo: EscopoReuniao;
  escopoId: string | null;
  pauta: string;
}

/** Devolve o id da reunião criada; os convocados são definidos pelo banco a partir do público. */
export async function criarReuniao(nova: NovaReuniao): Promise<string> {
  const { data, error } = await supabase.rpc('criar_reuniao', {
    p_titulo: nova.titulo,
    p_data: nova.data,
    p_hora: nova.hora,
    p_escopo: nova.escopo,
    p_escopo_id: nova.escopoId,
    p_pauta: nova.pauta,
  });
  if (error) throw error;
  return data as string;
}

/** `presencas`: pessoa → "presente" | "justificada" | "falta" | "" (ver presencasParaEnvio). */
export async function salvarPresencas(reuniaoId: string, presencas: Record<string, string>): Promise<void> {
  const { error } = await supabase.rpc('salvar_presencas', { p_reuniao: reuniaoId, p_presencas: presencas });
  if (error) throw error;
}

export async function encerrarReuniao(reuniaoId: string): Promise<void> {
  const { error } = await supabase.rpc('encerrar_reuniao', { p_reuniao: reuniaoId });
  if (error) throw error;
}

export async function salvarAta(reuniaoId: string, texto: string): Promise<void> {
  const { error } = await supabase.rpc('salvar_ata', { p_reuniao: reuniaoId, p_texto: texto });
  if (error) throw error;
}

export async function salvarTranscricao(reuniaoId: string, texto: string): Promise<void> {
  const { error } = await supabase.rpc('salvar_transcricao', { p_reuniao: reuniaoId, p_texto: texto });
  if (error) throw error;
}

export async function vincularTranscricao(transcricaoId: string, reuniaoId: string): Promise<void> {
  const { error } = await supabase.rpc('vincular_transcricao', { p_transcricao: transcricaoId, p_reuniao: reuniaoId });
  if (error) throw error;
}

/** Envia o arquivo ao bucket e registra o anexo; se o registro falhar, o arquivo enviado é removido. */
export async function enviarAnexo(reuniaoId: string, arquivo: File): Promise<void> {
  const caminho = caminhoDoAnexo(reuniaoId, arquivo.name, crypto.randomUUID().slice(0, 8));
  const tipo = arquivo.type || 'application/octet-stream';
  const envio = await supabase.storage.from(BUCKET_DE_ANEXOS).upload(caminho, arquivo, { contentType: tipo, upsert: false });
  if (envio.error) throw envio.error;
  const { error } = await supabase.rpc('registrar_anexo', {
    p_reuniao: reuniaoId, p_nome: arquivo.name, p_tipo: tipo, p_tamanho: arquivo.size, p_caminho: caminho,
  });
  if (error) {
    const limpeza = await supabase.storage.from(BUCKET_DE_ANEXOS).remove([caminho]);
    if (limpeza.error) registrarErro('Remover arquivo enviado sem registro', limpeza.error);
    throw error;
  }
}

/** Endereço temporário (1 minuto) para abrir ou baixar o arquivo. */
export async function enderecoDoAnexo(anexo: AnexoDaReuniao): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_DE_ANEXOS).createSignedUrl(anexo.caminho, 60);
  if (error) throw error;
  return data.signedUrl;
}

/** Remove o registro e depois o arquivo; falha ao apagar o arquivo vai só para o console (o anexo já saiu da lista). */
export async function removerAnexo(anexoId: string): Promise<void> {
  const { data, error } = await supabase.rpc('remover_anexo', { p_anexo: anexoId });
  if (error) throw error;
  const remocao = await supabase.storage.from(BUCKET_DE_ANEXOS).remove([data as string]);
  if (remocao.error) registrarErro('Apagar arquivo do anexo removido', remocao.error);
}

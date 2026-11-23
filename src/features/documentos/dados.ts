// Acesso a dados dos documentos gerais: lista pela visão documentos_painel (o banco não entrega a trainees),
// arquivo no bucket privado "documentos" e registro pelas funções do banco.
import { registrarErro } from '../../lib/erros';
import { supabase } from '../../lib/supabase';
import type { CategoriaDeDocumento, DocumentoDoPainel } from '../../types/database';

const BUCKET = 'documentos';

export interface DadosDosDocumentos {
  documentos: DocumentoDoPainel[];
  podeEnviar: boolean;
}

export async function carregarDocumentos(): Promise<DadosDosDocumentos> {
  const [documentos, permissoes] = await Promise.all([
    supabase.from('documentos_painel').select('*').order('enviado_em', { ascending: false }),
    supabase.from('permissoes_documentos').select('pode_enviar'),
  ]);
  if (documentos.error) throw documentos.error;
  if (permissoes.error) throw permissoes.error;
  return {
    documentos: (documentos.data ?? []) as DocumentoDoPainel[],
    podeEnviar: Boolean((permissoes.data?.[0] as { pode_enviar?: boolean } | undefined)?.pode_enviar),
  };
}

export interface NovoDocumento {
  titulo: string;
  categoria: CategoriaDeDocumento;
  descricao: string;
  arquivo: File;
}

/** Envia o arquivo e registra; se o registro falhar, apaga o arquivo enviado. */
export async function enviarDocumento(novo: NovoDocumento): Promise<void> {
  const nomeLimpo = novo.arquivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-120);
  const caminho = `${crypto.randomUUID()}/${nomeLimpo || 'arquivo'}`;
  const tipo = novo.arquivo.type || 'application/octet-stream';
  const envio = await supabase.storage.from(BUCKET).upload(caminho, novo.arquivo, { contentType: tipo, upsert: false });
  if (envio.error) throw envio.error;
  const { error } = await supabase.rpc('registrar_documento', {
    p_titulo: novo.titulo, p_categoria: novo.categoria, p_descricao: novo.descricao,
    p_nome: novo.arquivo.name, p_tipo: tipo, p_tamanho: novo.arquivo.size, p_caminho: caminho,
  });
  if (error) {
    const limpeza = await supabase.storage.from(BUCKET).remove([caminho]);
    if (limpeza.error) registrarErro('Remover documento enviado sem registro', limpeza.error);
    throw error;
  }
}

/** Endereço temporário (1 minuto) para abrir ou baixar o arquivo. */
export async function enderecoDoDocumento(documento: DocumentoDoPainel): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(documento.caminho, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function removerDocumento(id: string): Promise<void> {
  const { data, error } = await supabase.rpc('remover_documento', { p_id: id });
  if (error) throw error;
  const remocao = await supabase.storage.from(BUCKET).remove([data as string]);
  if (remocao.error) registrarErro('Apagar arquivo do documento removido', remocao.error);
}

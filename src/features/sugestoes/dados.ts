// Acesso a dados das Sugestões: leituras pelas visões sugestoes_painel e sugestao_comentarios_painel
// e gravações só pelas funções do banco (criar, apoiar, comentar e, para a Presidência e o desenvolvimento do SGI, responder).
import { supabase } from '../../lib/supabase';
import type { ComentarioDeSugestao, SituacaoDaSugestao, SugestaoDoPainel, TipoDeSugestao } from '../../types/database';

export async function carregarSugestoes(): Promise<SugestaoDoPainel[]> {
  const { data, error } = await supabase.from('sugestoes_painel').select('*');
  if (error) throw error;
  return (data ?? []) as SugestaoDoPainel[];
}

export async function carregarComentarios(sugestaoId: string): Promise<ComentarioDeSugestao[]> {
  const { data, error } = await supabase.from('sugestao_comentarios_painel').select('*').eq('sugestao_id', sugestaoId).order('criado_em');
  if (error) throw error;
  return (data ?? []) as ComentarioDeSugestao[];
}

export async function criarSugestao(sugestao: { tipo: TipoDeSugestao; titulo: string; descricao: string }): Promise<void> {
  const { error } = await supabase.rpc('criar_sugestao', { p_tipo: sugestao.tipo, p_titulo: sugestao.titulo, p_descricao: sugestao.descricao });
  if (error) throw error;
}

/** Devolve se a pessoa ficou apoiando (true) ou tirou o apoio (false). */
export async function apoiarSugestao(sugestaoId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('apoiar_sugestao', { p_id: sugestaoId });
  if (error) throw error;
  return data === true;
}

export async function comentarSugestao(sugestaoId: string, texto: string): Promise<void> {
  const { error } = await supabase.rpc('comentar_sugestao', { p_id: sugestaoId, p_texto: texto });
  if (error) throw error;
}

export async function responderSugestao(sugestaoId: string, situacao: SituacaoDaSugestao, resposta: string | null): Promise<void> {
  const { error } = await supabase.rpc('responder_sugestao', { p_id: sugestaoId, p_situacao: situacao, p_resposta: resposta });
  if (error) throw error;
}

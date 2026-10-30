// Sessão de quem está logado: perfil e nomes das áreas, lidos das visões do banco.
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Perfil } from '../types/database';

export interface ContextoDaSessao {
  perfil: Perfil;
  tituloDaArea: (id: string) => string;
}

/** Devolve null quando o login existe mas o e-mail não tem cadastro ativo no SGI. */
export async function carregarContexto(): Promise<ContextoDaSessao | null> {
  const [perfilResposta, areasResposta] = await Promise.all([
    supabase.from('meu_perfil').select('*').maybeSingle(),
    supabase.from('areas').select('id, titulo'),
  ]);
  if (perfilResposta.error) throw perfilResposta.error;
  if (areasResposta.error) throw areasResposta.error;
  if (!perfilResposta.data) return null;

  const titulos = new Map<string, string>();
  for (const area of areasResposta.data as { id: string; titulo: string }[]) titulos.set(area.id, area.titulo);
  return {
    perfil: perfilResposta.data as Perfil,
    tituloDaArea: (id) => titulos.get(id) ?? id,
  };
}

export async function enviarLinkDeAcesso(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function sair(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Avisa a cada mudança de sessão (inclusive a inicial). */
export function aoMudarSessao(acao: (sessao: Session | null) => void): void {
  supabase.auth.onAuthStateChange((_evento, sessao) => {
    // a documentação do Supabase recomenda não chamar o cliente dentro deste callback
    window.setTimeout(() => acao(sessao), 0);
  });
}

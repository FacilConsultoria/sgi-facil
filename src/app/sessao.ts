// Sessão de quem está logado (entrada por senha ou link do e-mail), perfil e nomes das áreas, lidos das visões do banco.
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { CHAVE_SENHA_DEFINIDA } from '../features/auth/regras';
import { supabase } from '../lib/supabase';
import { definirTratamentos } from '../lib/tratamento';
import type { Perfil } from '../types/database';

export interface ContextoDaSessao {
  perfil: Perfil;
  tituloDaArea: (id: string) => string;
}

/** Devolve null quando o login existe mas o e-mail não tem cadastro ativo no SGI. */
export async function carregarContexto(): Promise<ContextoDaSessao | null> {
  const [perfilResposta, areasResposta, cargosResposta] = await Promise.all([
    supabase.from('meu_perfil').select('*').maybeSingle(),
    supabase.from('areas').select('id, titulo'),
    // tratamento (feminino, masculino ou neutro) de quem ocupa a Presidência e a Vice-Presidência, para os textos
    supabase.from('pessoas').select('papel, tratamento, ativo'),
  ]);
  if (perfilResposta.error) throw perfilResposta.error;
  if (areasResposta.error) throw areasResposta.error;
  if (!perfilResposta.data) return null;
  // sem essa leitura os textos usam o nome do cargo, sem gênero; não impede a entrada
  definirTratamentos(cargosResposta.error ? [] : (cargosResposta.data ?? []) as { papel: string; tratamento: string; ativo: boolean }[]);

  const titulos = new Map<string, string>();
  for (const area of areasResposta.data as { id: string; titulo: string }[]) titulos.set(area.id, area.titulo);
  return {
    perfil: perfilResposta.data as Perfil,
    tituloDaArea: (id) => titulos.get(id) ?? id,
  };
}

/** Primeiro acesso: o link do e-mail abre a sessão, e a pessoa então cria a senha. */
export async function enviarLinkDeAcesso(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

/** "Esqueci minha senha": o link do e-mail abre a sessão em modo de recuperação (evento PASSWORD_RECOVERY). */
export async function enviarLinkDeRecuperacao(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) throw error;
}

export async function entrarComSenha(email: string, senha: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
}

/** Grava a senha e a marca de que ela já foi criada (senhaJaDefinida). */
export async function definirSenha(senha: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: senha, data: { [CHAVE_SENHA_DEFINIDA]: true } });
  if (error) throw error;
}

export async function sessaoAtual(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function sair(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Avisa a cada mudança de sessão (inclusive a inicial), dizendo também qual evento a causou. */
export function aoMudarSessao(acao: (sessao: Session | null, evento: AuthChangeEvent) => void): void {
  supabase.auth.onAuthStateChange((evento, sessao) => {
    // a documentação do Supabase recomenda não chamar o cliente dentro deste callback
    window.setTimeout(() => acao(sessao, evento), 0);
  });
}

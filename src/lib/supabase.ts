// Cliente Supabase único da aplicação. Nenhum outro módulo cria clientes.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const chavePublica = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Falso quando as variáveis de ambiente não foram configuradas (ver .env.example). */
export const configuracaoValida = Boolean(url && chavePublica);

// Com configuração ausente o cliente aponta para um endereço inválido e nunca é usado:
// main.ts mostra a tela de configuração antes de qualquer chamada.
export const supabase = createClient(url ?? 'https://configuracao-ausente.invalid', chavePublica ?? 'ausente', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

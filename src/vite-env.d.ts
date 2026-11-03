/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "desenvolvimento" no projeto de testes da Vercel; ausente na produção. */
  readonly VITE_AMBIENTE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

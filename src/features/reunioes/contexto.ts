// O que as partes do módulo de Reuniões e atas (lista, painel, formulários) compartilham.
import type { DadosDasReunioes } from './dados';

export interface ContextoDeReunioes {
  /** Elemento da página onde painéis e janelas são montados (fora do conteúdo, que é redesenhado). */
  pagina: HTMLElement;
  dados: DadosDasReunioes;
  /** Dia de hoje em São Paulo (AAAA-MM-DD). */
  hoje: string;
  /** Lê a lista de novo do banco e a redesenha, sem fechar o que estiver aberto; devolve o contexto novo (null se falhar). */
  recarregar: () => Promise<ContextoDeReunioes | null>;
}

// O que as partes do módulo de Demandas (quadro, painel, formulários) compartilham.
import type { Perfil } from '../../types/database';
import type { DadosDoQuadro } from './dados';

export interface ContextoDeDemandas {
  /** Elemento da página onde painéis e janelas são montados. */
  pagina: HTMLElement;
  perfil: Perfil;
  tituloDaArea: (id: string) => string;
  dados: DadosDoQuadro;
  /** Dia de hoje em São Paulo (AAAA-MM-DD). */
  hoje: string;
  /** Lê tudo de novo do banco e redesenha o quadro; devolve o contexto com os dados novos (null se falhar ou se a página já saiu da tela). */
  recarregar: () => Promise<ContextoDeDemandas | null>;
}

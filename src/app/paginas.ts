// Liga cada rota à sua tela. Módulos ainda não migrados mostram a tela "em migração".
import { paginaAutorizacoes } from '../features/autorizacoes/pagina';
import { paginaDashboard } from '../features/dashboard/pagina';
import { paginaDemandas } from '../features/demandas/pagina';
import { paginaEmMigracao } from '../features/em-migracao/pagina';
import { paginaPontuacao } from '../features/pontuacao/pagina';
import { paginaPresencas } from '../features/presencas/pagina';
import { paginaReunioes } from '../features/reunioes/pagina';
import type { Rota } from './rotas';
import type { ContextoDaSessao } from './sessao';

export function renderizarPagina(rota: Rota, destino: HTMLElement, contexto: ContextoDaSessao): void {
  switch (rota.id) {
    case 'dashboard':
      paginaDashboard(destino, contexto);
      return;
    case 'demandas':
      paginaDemandas(destino, contexto);
      return;
    case 'reunioes':
      paginaReunioes(destino);
      return;
    case 'autorizacoes':
      paginaAutorizacoes(destino);
      return;
    case 'presencas':
      paginaPresencas(destino, contexto);
      return;
    case 'pontuacao':
      paginaPontuacao(destino, contexto);
      return;
    default:
      paginaEmMigracao(destino, rota);
  }
}

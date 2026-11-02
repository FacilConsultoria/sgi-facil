// Autorizações: reúne os pedidos de acesso por exceção (Acessos) e os pedidos que dependem do aval
// da Presidência ou da Vice-Presidência (Avais) numa só tela, em duas abas.
import { presidenteOuVice } from '../../lib/tratamento';
import { montarPaginaComAbas } from '../../ui/abas';
import { montarAcessos } from '../acessos/pagina';
import { montarAvais } from '../avais/pagina';

type IdDaAba = 'acessos' | 'avais';

// a aba escolhida vale até a pessoa sair do sistema
let abaAtual: IdDaAba = 'acessos';

export function paginaAutorizacoes(destino: HTMLElement): void {
  montarPaginaComAbas<IdDaAba>(destino, {
    titulo: 'Autorizações',
    subtitulo: `Acessos por exceção a projetos e demandas, e os pedidos que dependem do aval ${presidenteOuVice('de')}.`,
    abas: [
      { id: 'acessos', titulo: 'Acessos', montar: montarAcessos },
      { id: 'avais', titulo: 'Avais', montar: montarAvais },
    ],
    inicial: abaAtual,
    aoEscolher: (id) => { abaAtual = id; },
  });
}

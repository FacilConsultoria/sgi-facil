// Pontuação e ranking: o saldo e o histórico de cada pessoa (Pontuações) e a classificação geral (Ranking),
// numa só tela, em duas abas.
import type { ContextoDaSessao } from '../../app/sessao';
import { montarPaginaComAbas } from '../../ui/abas';
import { montarPontuacoes } from './pontuacoes';
import { montarRanking } from './ranking';

type IdDaAba = 'pontuacoes' | 'ranking';

// a aba escolhida vale até a pessoa sair do sistema
let abaAtual: IdDaAba = 'pontuacoes';

export function paginaPontuacao(destino: HTMLElement, contexto: ContextoDaSessao): void {
  montarPaginaComAbas<IdDaAba>(destino, {
    titulo: 'Pontuação e ranking',
    subtitulo: 'Saldo de pontos, histórico de lançamentos e classificação. Entregas e faltas viram lançamentos; ajustes têm justificativa.',
    abas: [
      { id: 'pontuacoes', titulo: 'Pontuações', montar: (painel) => montarPontuacoes(painel, contexto) },
      { id: 'ranking', titulo: 'Ranking', montar: (painel) => montarRanking(painel, contexto) },
    ],
    inicial: abaAtual,
    aoEscolher: (id) => { abaAtual = id; },
  });
}

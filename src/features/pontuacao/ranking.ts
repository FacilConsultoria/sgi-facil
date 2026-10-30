// Aba Ranking: saldo de pontos das pessoas que quem consulta pode ver (a regra de visibilidade é do banco).
import type { ContextoDaSessao } from '../../app/sessao';
import { el } from '../../ui/dom';
import { montarRecarregavel } from '../../ui/recarregavel';
import { carregarRanking, type DadosDoRanking } from './dados';
import { introducaoDoRanking } from './regras';

const PODIO = 3;

export function montarRanking(destino: HTMLElement, sessao: ContextoDaSessao): void {
  montarRecarregavel<DadosDoRanking>(destino, {
    carregar: carregarRanking,
    operacao: 'Carregar ranking',
    textoDeCarregando: 'Carregando ranking…',
    desenhar: (dados) => desenhar(dados, sessao.perfil.id),
  });
}

function desenhar({ ranking, config }: DadosDoRanking, meuId: string): HTMLElement[] {
  const intro = el('p', { class: 'dica' }, introducaoDoRanking(config.ranking_publico));
  if (ranking.length === 0) return [intro, el('p', { class: 'vazio' }, 'Ninguém no ranking ainda.')];

  const linhas = ranking.map((pessoa, indice) => {
    const sou = pessoa.pessoa_id === meuId;
    return el('tr', { class: sou ? 'eu' : undefined },
      el('td', {}, el('span', { class: indice < PODIO ? 'posicao top' : 'posicao' }, indice + 1)),
      el('td', {}, pessoa.nome, sou ? el('span', { class: 'meta' }, ' (você)') : null),
      el('td', {}, pessoa.setor),
      el('td', { class: 'num' }, pessoa.entregas),
      el('td', { class: 'num' }, pessoa.faltas),
      el('td', { class: 'num pts' }, pessoa.pontos));
  });
  return [
    intro,
    el('div', { class: 'tab-wrap' },
      el('table', { class: 'tabela' },
        el('thead', {}, el('tr', {},
          el('th', { class: 'col-posicao' }, '#'), el('th', {}, 'Pessoa'), el('th', {}, 'Setor'),
          el('th', { class: 'num' }, 'Entregas'), el('th', { class: 'num' }, 'Faltas'), el('th', { class: 'num' }, 'Pontos'))),
        el('tbody', {}, ...linhas))),
  ];
}

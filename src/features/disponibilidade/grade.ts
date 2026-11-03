// A grade semanal em tabela: dias nas colunas, horas nas linhas. Duas versões: a que a pessoa marca (cada célula é um
// botão, e os títulos de dia e de hora marcam a coluna ou a linha inteira) e o mapa de calor de leitura, que mostra
// quantas pessoas escolhidas estão livres em cada horário.
import { el } from '../../ui/dom';
import {
  alternarDia, alternarHora, alternarHorario, codigoDoHorario, descreverHora, DIAS, HORAS, nivelDeCalor, type Horarios,
} from './regras';

export interface GradeEditavel {
  elemento: HTMLElement;
  selecionados: () => Set<number>;
  definir: (horarios: Horarios) => void;
}

export function montarGradeEditavel(inicial: Horarios, aoMudar: (horarios: Horarios) => void): GradeEditavel {
  let atuais: Horarios = new Set(inicial);
  const celulas = new Map<number, HTMLButtonElement>();

  const pintar = (): void => {
    for (const [codigo, botao] of celulas) {
      const marcado = atuais.has(codigo);
      botao.setAttribute('aria-pressed', String(marcado));
      botao.classList.toggle('marcada', marcado);
    }
  };
  const mudar = (novos: Horarios): void => {
    atuais = novos;
    pintar();
    aoMudar(atuais);
  };

  const titulosDosDias = DIAS.map((dia, indice) => {
    const botao = el('button', { type: 'button', class: 'titulo-grade', 'aria-label': `Marcar ou desmarcar ${dia.nome} inteiro` }, dia.curto);
    botao.addEventListener('click', () => mudar(alternarDia(atuais, indice)));
    return el('th', { scope: 'col' }, botao);
  });

  const linhas = HORAS.map((hora) => {
    const titulo = el('button', { type: 'button', class: 'titulo-grade', 'aria-label': `Marcar ou desmarcar ${descreverHora(hora)} em todos os dias` }, descreverHora(hora));
    titulo.addEventListener('click', () => mudar(alternarHora(atuais, hora)));
    return el('tr', {},
      el('th', { scope: 'row' }, titulo),
      ...DIAS.map((dia, indice) => {
        const botao = el('button', {
          type: 'button', class: 'celula', 'aria-pressed': 'false', 'data-dia': String(indice), 'data-hora': String(hora),
          'aria-label': `${dia.nome}, ${descreverHora(hora)}`,
        });
        botao.addEventListener('click', () => mudar(alternarHorario(atuais, indice, hora)));
        celulas.set(codigoDoHorario(indice, hora), botao);
        return el('td', {}, botao);
      }));
  });

  pintar();
  return {
    elemento: el('div', { class: 'tab-wrap grade-caixa' },
      el('table', { class: 'grade-semanal', 'aria-label': 'Disponibilidade da semana' },
        el('thead', {}, el('tr', {}, el('th', {}, ''), ...titulosDosDias)),
        el('tbody', {}, ...linhas))),
    selecionados: () => new Set(atuais),
    definir: (horarios) => {
      atuais = new Set(horarios);
      pintar();
    },
  };
}

/** Mapa de calor de leitura: cada célula mostra quantas das `total` pessoas estão livres naquele horário. */
export function montarMapaDeCalor(contagens: ReadonlyMap<number, number>, total: number): HTMLElement {
  const linhas = HORAS.map((hora) =>
    el('tr', {},
      el('th', { scope: 'row' }, descreverHora(hora)),
      ...DIAS.map((dia, indice) => {
        const disponiveis = contagens.get(codigoDoHorario(indice, hora)) ?? 0;
        return el('td', {
          class: `calor nivel-${nivelDeCalor(disponiveis, total)}`,
          title: `${dia.nome}, ${descreverHora(hora)}: ${disponiveis} de ${total}`,
        }, disponiveis > 0 ? String(disponiveis) : '');
      })));
  return el('div', { class: 'tab-wrap grade-caixa' },
    el('table', { class: 'grade-semanal calor-grade', 'aria-label': 'Pessoas disponíveis em cada horário' },
      el('thead', {}, el('tr', {}, el('th', {}, ''), ...DIAS.map((dia) => el('th', { scope: 'col' }, dia.curto)))),
      el('tbody', {}, ...linhas)));
}

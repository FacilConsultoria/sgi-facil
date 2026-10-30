// Peças visuais do módulo de Reuniões e atas: selos e linha da lista.
import { diaEMes } from '../../lib/datas';
import type { EscopoReuniao, ReuniaoVisivel } from '../../types/database';
import { el } from '../../ui/dom';
import { descreverReuniao, situacaoDaReuniao } from './regras';

const CLASSE_DO_PUBLICO: Record<EscopoReuniao, string> = {
  geral: 'chip',
  presidencia: 'chip m-presidencia',
  area: 'chip m-diretoria',
  nucleo: 'chip m-nucleo',
  pessoas: 'chip',
};

export function seloDoPublico(escopo: EscopoReuniao, nome: string): HTMLElement {
  return el('span', { class: CLASSE_DO_PUBLICO[escopo] }, nome);
}

/** Selo da direita na lista: o que falta fazer ou o que já foi feito na reunião. */
function seloDaSituacao(reuniao: ReuniaoVisivel, hoje: string): HTMLElement {
  switch (situacaoDaReuniao(reuniao, hoje)) {
    case 'encerrada':
      return reuniao.ata ? el('span', { class: 'chip ok' }, 'Ata registrada') : el('span', { class: 'chip s-revisao' }, 'Sem ata');
    case 'pendente':
      return el('span', { class: 'chip s-revisao' }, 'Presença pendente');
    case 'agendada':
      return el('span', { class: 'chip m-diretoria' }, 'Agendada');
  }
}

export function linhaDaReuniao(
  reuniao: ReuniaoVisivel,
  nomePublico: string,
  hoje: string,
  aoAbrir: (reuniao: ReuniaoVisivel) => void,
): HTMLButtonElement {
  const { dia, mes } = diaEMes(reuniao.data);
  const botao = el('button', { type: 'button', class: 'reuniao', 'data-reuniao': reuniao.id },
    el('span', { class: 'data-bloco' }, el('b', {}, dia), el('span', {}, mes)),
    el('span', { class: 'reuniao-info' },
      el('span', { class: 'item-tit' }, reuniao.titulo),
      el('span', { class: 'meta' }, descreverReuniao(reuniao, nomePublico))),
    seloDaSituacao(reuniao, hoje));
  botao.addEventListener('click', () => aoAbrir(reuniao));
  return botao;
}

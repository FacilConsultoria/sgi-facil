// Peças visuais do módulo de Demandas: selos, cartão do quadro e seleção de executores.
import { dataCurta } from '../../lib/datas';
import type { DemandaVisivel, Prioridade, StatusDemanda } from '../../types/database';
import { el } from '../../ui/dom';
import {
  estaAtrasada, iniciais, NOME_DA_PRIORIDADE, NOME_DO_MOTIVO, NOME_DO_STATUS, type GrupoDeExecutores,
} from './regras';

export function seloDeStatus(status: StatusDemanda): HTMLElement {
  return el('span', { class: `chip s-${status}` }, NOME_DO_STATUS[status]);
}

export function seloDePrioridade(prioridade: Prioridade): HTMLElement {
  return el('span', { class: `chip p-${prioridade}` }, NOME_DA_PRIORIDADE[prioridade]);
}

export function seloDeAcesso(demanda: Pick<DemandaVisivel, 'motivo_acesso' | 'excecao_ate'>): HTMLElement {
  if (demanda.motivo_acesso === 'excecao') {
    return el('span', { class: 'chip m-excecao', title: 'Liberação por exceção' },
      demanda.excecao_ate ? `Exceção · até ${dataCurta(demanda.excecao_ate)}` : 'Exceção');
  }
  return el('span', { class: `chip m-${demanda.motivo_acesso}` }, NOME_DO_MOTIVO[demanda.motivo_acesso]);
}

export function seloDeRestricao(): HTMLElement {
  return el('span', { class: 'chip restrito' }, 'Restrito à Presidência');
}

function avatares(ids: readonly string[], nomeDe: (id: string) => string): HTMLElement {
  return el('span', { class: 'avatares' },
    ...ids.map((id) => el('span', { class: 'av', title: nomeDe(id) }, iniciais(nomeDe(id)))));
}

export function cartaoDaDemanda(
  demanda: DemandaVisivel,
  nomeDe: (id: string) => string,
  hoje: string,
  aoAbrir: (demanda: DemandaVisivel) => void,
): HTMLButtonElement {
  const atrasada = estaAtrasada(demanda, hoje);
  const executores = demanda.executores.map(nomeDe).join(', ');
  const cartao = el('button', {
    type: 'button',
    class: demanda.restrita ? 'card restrita' : 'card',
    'data-demanda': demanda.id,
    'aria-label': `${demanda.codigo}: ${demanda.titulo}. Prazo ${dataCurta(demanda.prazo)}${atrasada ? ', atrasada' : ''}. Executores: ${executores}.`,
  },
    el('span', { class: 'card-top' },
      el('span', { class: 'mono' }, demanda.codigo),
      seloDePrioridade(demanda.prioridade)),
    el('span', { class: 'card-tit' }, demanda.titulo),
    el('span', { class: 'card-proj' }, [demanda.projeto_nome, demanda.projeto_cliente].filter(Boolean).join(' · ')),
    el('span', { class: 'card-pe' },
      el('span', { class: atrasada ? 'prazo atrasada' : 'prazo' }, `${atrasada ? 'Atrasada · ' : ''}${dataCurta(demanda.prazo)}`),
      demanda.motivo_acesso === 'executor' || demanda.motivo_acesso === 'excecao' ? seloDeAcesso(demanda) : null,
      avatares(demanda.executores, nomeDe)));
  cartao.addEventListener('click', () => aoAbrir(demanda));
  return cartao;
}

export interface SeletorDeExecutores {
  elemento: HTMLFieldSetElement;
  marcados: () => string[];
}

/** Lista de caixas de seleção agrupada (ver agruparExecutores). */
export function seletorDeExecutores(prefixo: string, grupos: readonly GrupoDeExecutores[], selecionados: readonly string[]): SeletorDeExecutores {
  const caixas: HTMLInputElement[] = [];
  const lista = el('div', { class: 'picker' });
  for (const grupo of grupos) {
    lista.append(el('div', { class: 'grupo' }, grupo.titulo));
    for (const pessoa of grupo.pessoas) {
      const id = `${prefixo}-ex-${pessoa.id}`;
      const caixa = el('input', { type: 'checkbox', id, value: pessoa.id, checked: selecionados.includes(pessoa.id) });
      caixas.push(caixa);
      lista.append(el('label', { for: id }, caixa, ` ${pessoa.nome}`));
    }
  }
  if (grupos.length === 0) lista.append(el('p', { class: 'dica' }, 'Ninguém disponível no seu escopo.'));
  return {
    elemento: el('fieldset', {}, el('legend', {}, 'Executores'), lista),
    marcados: () => caixas.filter((caixa) => caixa.checked).map((caixa) => caixa.value),
  };
}

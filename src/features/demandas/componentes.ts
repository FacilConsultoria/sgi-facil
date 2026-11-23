// Peças visuais do módulo de Demandas: selos, cartão do quadro e seleção de executores.
import { dataCurta } from '../../lib/datas';
import type { DemandaVisivel, Prioridade, StatusDemanda } from '../../types/database';
import { el } from '../../ui/dom';
import {
  estaAtrasada, estadoDoPrazo, iniciais, NOME_DA_PRIORIDADE, NOME_DO_ESTADO_DO_PRAZO, NOME_DO_MOTIVO, NOME_DO_STATUS, type GrupoDeExecutores,
} from './regras';
import { PERGUNTA_DO_EXECUTOR, type PapelNaRaci } from './raci';

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

/** Selo do papel na matriz RACI: R, A, A/R ou I. */
export function seloDePapel(papel: PapelNaRaci): HTMLElement {
  const classe = papel === 'A/R' ? 'ar' : papel.toLowerCase();
  const nome = { R: 'Executa', A: 'Aprova', 'A/R': 'Executa e aprova', I: 'É informado' }[papel];
  return el('span', { class: `chip ${classe}`, title: nome }, papel);
}

export function seloDeRestricao(): HTMLElement {
  return el('span', { class: 'chip restrito' }, 'Restrito à Presidência');
}

/** Cor fixa de cada pessoa (a mesma em todos os cartões), para diferenciar quem tem iniciais parecidas. */
function corDoAvatar(id: string): number {
  let soma = 0;
  for (const letra of id) soma = (soma * 31 + letra.charCodeAt(0)) % 9973;
  return soma % 8;
}

/** Iniciais do nome completo (primeira e última), com a cor da pessoa; o nome mostrado vai na dica. */
function avatares(ids: readonly string[], nomeDe: (id: string) => string, nomeCompletoDe: (id: string) => string): HTMLElement {
  return el('span', { class: 'avatares' },
    ...ids.map((id) => el('span', { class: `av c${corDoAvatar(id)}`, title: nomeDe(id) }, iniciais(nomeCompletoDe(id)))));
}

export function cartaoDaDemanda(
  demanda: DemandaVisivel,
  nomeDe: (id: string) => string,
  hoje: string,
  aoAbrir: (demanda: DemandaVisivel) => void,
  nomeCompletoDe: (id: string) => string = nomeDe,
): HTMLButtonElement {
  const atrasada = estaAtrasada(demanda, hoje);
  const estado = estadoDoPrazo(demanda, hoje);
  const executores = demanda.executores.map(nomeDe).join(', ');
  const cartao = el('button', {
    type: 'button',
    class: demanda.restrita ? 'card restrita' : 'card',
    'data-demanda': demanda.id,
    'aria-label': `${demanda.codigo}: ${demanda.titulo}. Prazo ${dataCurta(demanda.prazo)}${estado ? `, ${NOME_DO_ESTADO_DO_PRAZO[estado].toLowerCase()}` : ''}. Executores: ${executores}.`,
  },
    el('span', { class: 'card-top' },
      el('span', { class: 'mono' }, demanda.codigo),
      seloDePrioridade(demanda.prioridade)),
    el('span', { class: 'card-tit' }, demanda.titulo),
    demanda.duvida_aberta || demanda.eh_ar || demanda.na_minha_caixa
      ? el('span', { class: 'card-raci' },
        demanda.na_minha_caixa ? el('span', { class: 'chip caixa' }, 'Na sua caixa') : null,
        demanda.duvida_aberta ? el('span', { class: 'chip duvida' }, 'Dúvida') : null,
        demanda.eh_ar ? seloDePapel('A/R') : null)
      : null,
    el('span', { class: 'card-proj' }, [demanda.projeto_nome, demanda.projeto_cliente].filter(Boolean).join(' · ')),
    el('span', { class: 'card-pe' },
      el('span', { class: atrasada ? 'prazo atrasada' : 'prazo' }, `${atrasada ? 'Atrasada · ' : ''}${dataCurta(demanda.prazo)}`),
      demanda.motivo_acesso === 'executor' || demanda.motivo_acesso === 'excecao' ? seloDeAcesso(demanda) : null,
      avatares(demanda.executores, nomeDe, nomeCompletoDe)));
  cartao.addEventListener('click', () => aoAbrir(demanda));
  return cartao;
}

export interface SeletorDeExecutores {
  elemento: HTMLFieldSetElement;
  marcados: () => string[];
}

/** Lista de caixas de seleção agrupada (ver agruparExecutores). Avisa a cada marcação pelo evento "change" do elemento. */
export function seletorDeExecutores(
  prefixo: string,
  grupos: readonly GrupoDeExecutores[],
  selecionados: readonly string[],
  legenda = '1. Executores (R)',
): SeletorDeExecutores {
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
    elemento: el('fieldset', { class: 'passo-raci' }, el('legend', {}, legenda), el('p', { class: 'pergunta' }, PERGUNTA_DO_EXECUTOR), lista),
    marcados: () => caixas.filter((caixa) => caixa.checked).map((caixa) => caixa.value),
  };
}

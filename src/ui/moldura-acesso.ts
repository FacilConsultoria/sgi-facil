// Telas fora da aplicação logada: assinatura da marca sobre o azul-escuro oficial
// e, abaixo, um cartão branco com o conteúdo (login, avisos).
import { el } from './dom';
import { criarSimbolo } from './logo';

export function molduraDeAcesso(...conteudo: Node[]): HTMLElement {
  return el('div', { class: 'tela-acesso' },
    el('header', { class: 'assinatura' },
      criarSimbolo('assinatura-simbolo'),
      el('div', { class: 'assinatura-texto' },
        el('strong', {}, 'Fácil Consultoria'),
        el('span', {}, 'Sistema de Gestão Interna'))),
    el('section', { class: 'cartao-acesso' }, ...conteudo));
}

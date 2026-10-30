// Cartão centralizado com a marca, usado nas telas fora da aplicação logada.
import { el } from './dom';
import { criarSimbolo } from './logo';

export function molduraDeAcesso(...conteudo: Node[]): HTMLElement {
  return el('div', { class: 'tela-acesso' },
    el('section', { class: 'cartao-acesso' },
      el('div', { class: 'marca-acesso' }, criarSimbolo('logo-acesso'), el('strong', {}, 'SGI Fácil Consultoria')),
      ...conteudo));
}

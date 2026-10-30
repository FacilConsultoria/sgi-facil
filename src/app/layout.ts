// Moldura da aplicação: menu lateral (marca, pessoa logada, navegação) e área de conteúdo.
import { descreverCargo } from '../lib/perfil';
import { el, substituir } from '../ui/dom';
import { criarSimbolo } from '../ui/logo';
import { ROTAS, type Rota } from './rotas';
import type { ContextoDaSessao } from './sessao';

export interface Layout {
  conteudo: HTMLElement;
  marcarRotaAtiva: (rota: Rota) => void;
}

export function montarLayout(raiz: HTMLElement, contexto: ContextoDaSessao, aoSair: () => void): Layout {
  const { perfil, tituloDaArea } = contexto;

  const botoesDaNavegacao = ROTAS.map((rota) =>
    el('a', { href: `#${rota.id}`, class: 'nav-item', 'data-rota': rota.id },
      el('span', {}, rota.titulo),
      rota.disponivel ? null : el('span', { class: 'nav-selo' }, 'em breve')),
  );

  const lateral = el('aside', { class: 'lateral', id: 'lateral', 'aria-label': 'Menu principal' },
    el('div', { class: 'marca' },
      criarSimbolo(),
      el('div', {},
        el('strong', {}, 'FÁCIL'),
        el('span', { class: 'consultoria' }, 'CONSULTORIA'),
        el('small', {}, 'Sistema de Gestão Interna'))),
    el('div', { class: 'quem' },
      el('strong', {}, perfil.nome),
      el('span', {}, descreverCargo(perfil, tituloDaArea))),
    el('nav', { class: 'nav' }, ...botoesDaNavegacao),
    el('button', { type: 'button', class: 'sair' }, 'Sair'),
  );

  const conteudo = el('main', { class: 'conteudo-principal', id: 'conteudo' });
  const botaoMenu = el('button', { type: 'button', class: 'abrir-menu', 'aria-controls': 'lateral', 'aria-expanded': 'false' }, 'Menu');
  const tituloMovel = el('strong', {}, 'SGI');
  const app = el('div', { class: 'app' },
    lateral,
    el('div', { class: 'coluna-conteudo' }, el('div', { class: 'barra-movel' }, botaoMenu, tituloMovel), conteudo));

  const alternarMenu = (aberto: boolean): void => {
    app.classList.toggle('menu-aberto', aberto);
    botaoMenu.setAttribute('aria-expanded', String(aberto));
  };
  botaoMenu.addEventListener('click', () => alternarMenu(!app.classList.contains('menu-aberto')));
  lateral.addEventListener('click', (evento) => {
    if (evento.target instanceof Element && evento.target.closest('.nav-item')) alternarMenu(false);
  });
  lateral.querySelector('.sair')?.addEventListener('click', aoSair);

  substituir(raiz, app);

  return {
    conteudo,
    marcarRotaAtiva: (rota) => {
      for (const botao of botoesDaNavegacao) {
        const ativo = botao.dataset.rota === rota.id;
        if (ativo) botao.setAttribute('aria-current', 'page');
        else botao.removeAttribute('aria-current');
      }
      tituloMovel.textContent = rota.titulo;
    },
  };
}

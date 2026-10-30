// Página com título e abas: cada aba monta o próprio conteúdo dentro do painel.
import { el, substituir } from './dom';

export interface Aba<Id extends string> {
  id: Id;
  titulo: string;
  montar: (destino: HTMLElement) => void;
}

export interface PaginaComAbas<Id extends string> {
  titulo: string;
  subtitulo: string;
  abas: readonly Aba<Id>[];
  /** Aba aberta ao entrar na página. */
  inicial: Id;
  /** Avisa a cada troca, para quem chama lembrar a aba escolhida. */
  aoEscolher: (id: Id) => void;
}

export function montarPaginaComAbas<Id extends string>(destino: HTMLElement, pagina: PaginaComAbas<Id>): void {
  const painel = el('div', { class: 'painel-da-aba', role: 'tabpanel' });
  const botoes = pagina.abas.map((aba) => {
    const botao = el('button', { type: 'button', class: 'aba', role: 'tab', id: `aba-${aba.id}` }, aba.titulo);
    botao.addEventListener('click', () => escolher(aba.id));
    return { aba, botao };
  });

  const escolher = (id: Id): void => {
    pagina.aoEscolher(id);
    for (const { aba, botao } of botoes) botao.setAttribute('aria-selected', String(aba.id === id));
    painel.setAttribute('aria-labelledby', `aba-${id}`);
    pagina.abas.find((aba) => aba.id === id)?.montar(painel);
  };

  substituir(destino,
    el('section', { class: 'cab' },
      el('div', {}, el('h1', {}, pagina.titulo), el('p', { class: 'sub' }, pagina.subtitulo))),
    el('div', { class: 'abas', role: 'tablist' }, ...botoes.map(({ botao }) => botao)),
    painel);
  escolher(pagina.inicial);
}

// Autorizações: reúne os pedidos de acesso por exceção (Acessos) e os pedidos que dependem do aval
// da Presidente ou da Vice (Avais) numa só tela, em duas abas.
import { montarAcessos } from '../acessos/pagina';
import { montarAvais } from '../avais/pagina';
import { el, substituir } from '../../ui/dom';

type IdDaAba = 'acessos' | 'avais';

const ABAS: readonly { id: IdDaAba; titulo: string; montar: (destino: HTMLElement) => void }[] = [
  { id: 'acessos', titulo: 'Acessos', montar: montarAcessos },
  { id: 'avais', titulo: 'Avais', montar: montarAvais },
];

// a aba escolhida vale até a pessoa sair do sistema
let abaAtual: IdDaAba = 'acessos';

export function paginaAutorizacoes(destino: HTMLElement): void {
  const painel = el('div', { class: 'painel-da-aba', role: 'tabpanel' });
  const botoes = ABAS.map((aba) => {
    const botao = el('button', { type: 'button', class: 'aba', role: 'tab', id: `aba-${aba.id}` }, aba.titulo);
    botao.addEventListener('click', () => escolher(aba.id));
    return { aba, botao };
  });

  const escolher = (id: IdDaAba): void => {
    abaAtual = id;
    for (const { aba, botao } of botoes) botao.setAttribute('aria-selected', String(aba.id === id));
    painel.setAttribute('aria-labelledby', `aba-${id}`);
    ABAS.find((aba) => aba.id === id)?.montar(painel);
  };

  substituir(destino,
    el('section', { class: 'cab' },
      el('div', {},
        el('h1', {}, 'Autorizações'),
        el('p', { class: 'sub' }, 'Acessos por exceção a projetos e demandas, e os pedidos que dependem do aval da Presidente ou da Vice-Presidência.'))),
    el('div', { class: 'abas', role: 'tablist' }, ...botoes.map(({ botao }) => botao)),
    painel);
  escolher(abaAtual);
}

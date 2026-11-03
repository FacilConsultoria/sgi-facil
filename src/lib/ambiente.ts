// Ambiente em que o site roda. O projeto de testes da Vercel (sgi-facil-dev) define VITE_AMBIENTE=desenvolvimento
// e aponta para o banco de dados fictícios; a produção não define a variável.
import { el } from '../ui/dom';

export const ehDesenvolvimento = import.meta.env.VITE_AMBIENTE === 'desenvolvimento';

/** No ambiente de desenvolvimento: faixa fixa no topo e "[DEV]" no título da aba, para nunca confundir com a produção. */
export function marcarAmbiente(): void {
  if (!ehDesenvolvimento) return;
  document.title = `[DEV] ${document.title}`;
  document.body.prepend(el('div', { class: 'faixa-ambiente', role: 'note' },
    'Ambiente de desenvolvimento · dados fictícios, nada aqui afeta a produção'));
}

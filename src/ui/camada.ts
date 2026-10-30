// Painel lateral e janela modal: véu, foco preso dentro da caixa, Esc para fechar
// e devolução do foco a quem abriu. A camada fica dentro da página que a abriu,
// então some sozinha quando a página é trocada (navegação ou troca de sessão).
import { anexar, el, type Filho } from './dom';

export interface Camada {
  caixa: HTMLElement;
  fechar: () => void;
}

export interface OpcoesDaCamada {
  /** "painel" desliza da direita (detalhes); "modal" fica no centro (formulários curtos). */
  tipo: 'painel' | 'modal';
  /** id do título visível, que dá nome ao diálogo para leitores de tela. */
  idDoTitulo: string;
  /** Monta o conteúdo; recebe a função de fechar para os botões internos. */
  montar: (fechar: () => void) => Filho[];
}

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function abrirCamada(pai: HTMLElement, opcoes: OpcoesDaCamada): Camada {
  const origem = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const veu = el('div', { class: 'veu' });
  const caixa = el(opcoes.tipo === 'painel' ? 'aside' : 'div', {
    class: opcoes.tipo,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': opcoes.idDoTitulo,
    tabindex: '-1',
  });
  const camada = el('div', { class: 'camada' }, veu, caixa);

  let aberta = true;
  const fechar = (): void => {
    if (!aberta) return;
    aberta = false;
    camada.remove();
    if (origem?.isConnected) origem.focus();
  };

  anexar(caixa, opcoes.montar(fechar));

  veu.addEventListener('click', fechar);
  camada.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      fechar();
      return;
    }
    if (evento.key !== 'Tab') return;
    const focaveis = [...caixa.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((item) => item.offsetParent !== null);
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (!primeiro || !ultimo) return;
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  });

  pai.append(camada);
  caixa.focus();
  return { caixa, fechar };
}

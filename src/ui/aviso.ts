// Aviso flutuante (toast) para confirmar ações ou mostrar erros.
import { el } from './dom';

let caixa: HTMLDivElement | null = null;
let temporizador: number | undefined;

export function mostrarAviso(texto: string, tipo: 'sucesso' | 'erro' = 'sucesso'): void {
  if (!caixa) {
    caixa = el('div', { class: 'aviso-flutuante', role: 'status', 'aria-live': 'polite' });
    document.body.append(caixa);
  }
  caixa.textContent = texto;
  caixa.classList.toggle('erro', tipo === 'erro');
  caixa.hidden = false;
  window.clearTimeout(temporizador);
  temporizador = window.setTimeout(() => {
    if (caixa) caixa.hidden = true;
  }, 4000);
}

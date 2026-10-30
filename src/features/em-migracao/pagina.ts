// Tela provisória para módulos que ainda não saíram do protótipo.
import type { Rota } from '../../app/rotas';
import { el, substituir } from '../../ui/dom';

export function paginaEmMigracao(destino: HTMLElement, rota: Rota): void {
  substituir(destino,
    el('section', { class: 'cab' }, el('div', {}, el('h1', {}, rota.titulo))),
    el('p', { class: 'vazio' }, `O módulo ${rota.titulo} ainda está sendo migrado do protótipo e chega em uma das próximas versões.`),
  );
}

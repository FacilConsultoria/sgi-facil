// Projetos: andamento dos projetos que a pessoa enxerga, em cartões. Os números e o tipo de acesso vêm da
// visão projetos_painel (a RLS já aplicou a hierarquia); aqui nada decide permissão.
import type { ProjetoDoPainel } from '../../types/database';
import { el, substituir } from '../../ui/dom';
import { montarRecarregavel } from '../../ui/recarregavel';
import { pedirDemandasDoProjeto } from '../demandas/pagina';
import { carregarProjetos } from './dados';
import {
  descreverAndamento, descreverAtrasadas, descreverOrigem, introducaoDosProjetos, ordenarProjetos, percentualConcluido, seloDoAcesso,
} from './regras';

export function paginaProjetos(destino: HTMLElement): void {
  const subtitulo = el('p', { class: 'sub' }, 'Andamento dos projetos no seu escopo.');
  const corpo = el('div', {});
  substituir(destino, el('section', { class: 'cab' }, el('div', {}, el('h1', {}, 'Projetos'), subtitulo)), corpo);

  montarRecarregavel<ProjetoDoPainel[]>(corpo, {
    carregar: carregarProjetos,
    operacao: 'Carregar projetos',
    textoDeCarregando: 'Carregando projetos…',
    desenhar: (projetos) => {
      subtitulo.textContent = introducaoDosProjetos(projetos);
      if (projetos.length === 0) return [el('p', { class: 'vazio' }, 'Nenhum projeto visível para o seu perfil.')];
      return [el('div', { class: 'grade-projetos' }, ...ordenarProjetos(projetos).map(cartaoDoProjeto))];
    },
  });
}

function cartaoDoProjeto(projeto: ProjetoDoPainel): HTMLElement {
  const percentual = percentualConcluido(projeto);
  const selo = seloDoAcesso(projeto.acesso);
  const atrasadas = descreverAtrasadas(projeto.atrasadas);

  const barra = el('div', { class: 'barra', role: 'img', 'aria-label': `${percentual}% concluído` }, el('i', {}));
  barra.firstElementChild?.setAttribute('style', `width: ${percentual}%`);

  const verDemandas = el('button', { type: 'button', class: 'btn peq' }, 'Ver demandas');
  verDemandas.addEventListener('click', () => {
    pedirDemandasDoProjeto(projeto.id);
    window.location.hash = '#demandas';
  });

  return el('article', { class: 'bloco cartao-projeto' },
    el('div', { class: 'linha cartao-projeto-topo' },
      el('span', { class: 'eyebrow' }, descreverOrigem(projeto)),
      projeto.restrito ? el('span', { class: 'chip restrito' }, 'Restrito à Presidência') : null,
      selo ? el('span', { class: `chip ${selo.classe}` }, selo.texto) : null,
      projeto.ativo ? null : el('span', { class: 'chip' }, 'Encerrado')),
    el('h3', {}, projeto.nome),
    projeto.cliente ? el('p', { class: 'meta' }, projeto.cliente) : null,
    barra,
    el('div', { class: 'linha meta cartao-projeto-numeros' },
      el('span', {}, descreverAndamento(projeto)),
      atrasadas ? el('span', { class: 'atrasadas' }, atrasadas) : null),
    projeto.total_demandas > 0 ? el('div', { class: 'linha' }, verDemandas) : null);
}

// Presenças: frequência de cada pessoa que quem consulta acompanha, nas reuniões encerradas.
import type { ContextoDaSessao } from '../../app/sessao';
import { el, substituir } from '../../ui/dom';
import { montarRecarregavel } from '../../ui/recarregavel';
import type { FrequenciaDaPessoa } from '../../types/database';
import { carregarFrequencia } from './dados';
import { descreverTaxa, introducaoDaFrequencia, ordenarPorFrequencia, taxaDeFrequencia } from './regras';

export function paginaPresencas(destino: HTMLElement, contexto: ContextoDaSessao): void {
  const titulo = el('h1', {}, 'Presenças');
  const subtitulo = el('p', { class: 'sub' }, 'Presença nas reuniões encerradas.');
  const corpo = el('div', {});
  substituir(destino, el('section', { class: 'cab' }, el('div', {}, titulo, subtitulo)), corpo);

  montarRecarregavel<FrequenciaDaPessoa[]>(corpo, {
    carregar: carregarFrequencia,
    operacao: 'Carregar presenças',
    textoDeCarregando: 'Carregando presenças…',
    desenhar: (linhas) => {
      subtitulo.textContent = introducaoDaFrequencia(linhas, contexto.perfil.id);
      return desenhar(linhas, contexto.perfil.id);
    },
  });
}

function desenhar(linhas: readonly FrequenciaDaPessoa[], meuId: string): HTMLElement[] {
  if (linhas.length === 0) return [el('p', { class: 'vazio' }, 'Nenhuma pessoa para mostrar.')];
  const corpo = ordenarPorFrequencia(linhas).map((linha) => {
    const sou = linha.pessoa_id === meuId;
    return el('tr', { class: sou ? 'eu' : undefined },
      el('td', {}, linha.nome, sou ? el('span', { class: 'meta' }, ' (você)') : null),
      el('td', {}, linha.setor),
      el('td', { class: 'num' }, linha.convocacoes),
      el('td', { class: 'num' }, linha.presencas),
      el('td', { class: 'num' }, linha.justificadas),
      el('td', { class: linha.faltas > 0 ? 'num alerta' : 'num' }, linha.faltas),
      el('td', { class: 'num' }, descreverTaxa(taxaDeFrequencia(linha))));
  });
  return [
    el('div', { class: 'tab-wrap' },
      el('table', { class: 'tabela' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Pessoa'), el('th', {}, 'Setor'),
          el('th', { class: 'num' }, 'Convocações'), el('th', { class: 'num' }, 'Presenças'),
          el('th', { class: 'num' }, 'Justificadas'), el('th', { class: 'num' }, 'Faltas'), el('th', { class: 'num' }, 'Frequência'))),
        el('tbody', {}, ...corpo))),
  ];
}

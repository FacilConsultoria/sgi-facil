// Aba Organograma: os cargos deste ano em árvore, da Presidência para baixo, todos em retângulos do mesmo
// tamanho. Clicar num retângulo abre a função do cargo. O diretório de pessoas é aberto a quem tem cadastro
// (decisão do banco, supabase/01); só a Presidência vê "Definir liderança" (indicador de areas_da_estrutura).
import type { ContextoDaSessao } from '../../app/sessao';
import type { AreaDaEstrutura } from '../../types/database';
import { el } from '../../ui/dom';
import { botaoFechar } from '../../ui/formulario';
import { abrirCamada } from '../../ui/camada';
import type { DadosDaEstrutura } from './dados';
import { abrirDefinirLideranca } from './lideranca';
import { descreverFuncao, montarOrganograma, nomeNoRetangulo, ORGANOGRAMA_DESTE_ANO, type NoDoOrganograma } from './organograma-regras';
import { iniciais } from './regras';

export interface ContextoDoOrganograma {
  /** Onde as janelas são montadas (fora do conteúdo, que é redesenhado). */
  pagina: HTMLElement;
  dados: DadosDaEstrutura;
  sessao: ContextoDaSessao;
  recarregar: () => Promise<void>;
}

export function desenharOrganograma(contexto: ContextoDoOrganograma): HTMLElement[] {
  const { areas, nucleos, pessoas } = contexto.dados;
  const raiz = montarOrganograma(ORGANOGRAMA_DESTE_ANO, areas, nucleos, pessoas);
  const meuId = contexto.sessao.perfil.id;

  const retangulo = (no: NoDoOrganograma): HTMLButtonElement => {
    const nome = nomeNoRetangulo(no, meuId);
    const botao = el('button', { type: 'button', class: no.pessoa ? 'no' : 'no vago', 'aria-haspopup': 'dialog' },
      el('span', { class: 'av', 'aria-hidden': 'true' }, no.pessoa ? iniciais(no.pessoa.nome) : '?'),
      el('span', { class: 'no-txt' }, el('b', {}, no.titulo), el('span', { title: nome }, nome)));
    botao.addEventListener('click', () => abrirFuncao(contexto, no));
    return botao;
  };
  const item = (no: NoDoOrganograma): HTMLElement =>
    el('li', {}, retangulo(no), no.filhos.length ? el('ul', {}, ...no.filhos.map(item)) : null);

  return [
    el('p', { class: 'dica' }, 'Clique em um cargo para ver a função.'),
    el('div', { class: 'arvore' }, el('ul', {}, item(raiz))),
  ];
}

/** Janela do cargo: quem é, a função e, para a Presidência, o atalho de definir titular e cobertura. */
function abrirFuncao(contexto: ContextoDoOrganograma, no: NoDoOrganograma): void {
  abrirCamada(contexto.pagina, {
    tipo: 'modal',
    idDoTitulo: 'funcao-titulo',
    montar: (fechar) => {
      const fecharJanela = el('button', { type: 'button', class: 'btn' }, 'Fechar');
      fecharJanela.addEventListener('click', fechar);
      const botaoDeLideranca = (area: AreaDaEstrutura): HTMLButtonElement => {
        const definir = el('button', { type: 'button', class: 'btn' }, 'Definir liderança');
        definir.addEventListener('click', () => {
          fechar();
          abrirDefinirLideranca({ pagina: contexto.pagina, candidatos: contexto.dados.candidatos, recarregar: contexto.recarregar }, area);
        });
        return definir;
      };
      const definir = no.area?.pode_definir_lideranca ? botaoDeLideranca(no.area) : null;
      return [
        el('div', { class: 'form-janela' },
          el('div', { class: 'painel-cab' }, el('h2', { id: 'funcao-titulo' }, no.titulo), botaoFechar(fechar)),
          el('div', { class: 'painel-corpo' },
            el('div', { class: 'no-pessoa' },
              el('span', { class: 'av', 'aria-hidden': 'true' }, no.pessoa ? iniciais(no.pessoa.nome) : '?'),
              el('b', {}, nomeNoRetangulo(no, contexto.sessao.perfil.id))),
            el('h3', {}, 'Função'),
            el('p', { class: 'texto-da-funcao' }, descreverFuncao(no))),
          el('div', { class: 'modal-pe' }, definir, fecharJanela)),
      ];
    },
  });
}

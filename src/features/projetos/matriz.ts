// Janela com a matriz RACI de um projeto: uma linha por demanda, uma coluna por pessoa (R executa, A aprova,
// A/R executa e aprova, I é informado) e com quem cada demanda está agora. Só leitura; cada linha abre a demanda.
import { dataCurta } from '../../lib/datas';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import type { ProjetoDoPainel } from '../../types/database';
import { abrirCamada } from '../../ui/camada';
import { el, substituir } from '../../ui/dom';
import { botaoFechar } from '../../ui/formulario';
import { seloDePapel, seloDeStatus } from '../demandas/componentes';
import { pedirPainelDaDemanda } from '../demandas/pagina';
import { descreverComQuem, montarMatriz, NOME_DO_ALCANCE } from '../demandas/raci';
import { carregarMatriz, type DadosDaMatriz } from './dados';

export function abrirMatrizDoProjeto(pai: HTMLElement, projeto: ProjetoDoPainel): void {
  const idDoTitulo = 'matriz-raci-titulo';
  const corpo = el('div', { class: 'painel-corpo' }, el('p', { class: 'meta' }, 'Carregando a matriz…'));
  const camada = abrirCamada(pai, {
    tipo: 'modal',
    idDoTitulo,
    montar: (fechar) => [
      el('div', { class: 'painel-cab' },
        el('div', {}, el('h2', { id: idDoTitulo }, 'Matriz RACI'), el('p', { class: 'meta' }, projeto.nome)),
        botaoFechar(fechar)),
      corpo,
    ],
  });
  camada.caixa.classList.add('modal-largo');

  carregarMatriz(projeto.id)
    .then((dados) => substituir(corpo, ...desenharMatriz(dados, camada.fechar)))
    .catch((falha: unknown) => {
      registrarErro('Carregar matriz RACI', falha);
      substituir(corpo, el('p', {}, `Não foi possível carregar a matriz. ${mensagemParaUsuario(falha)}`));
    });
}

function desenharMatriz(dados: DadosDaMatriz, fechar: () => void): HTMLElement[] {
  const matriz = montarMatriz(dados.demandas, dados.nomeDe);
  if (!matriz.linhas.length) return [el('p', { class: 'vazio' }, 'Nenhuma demanda visível para você neste projeto.')];

  const cabecalho = el('tr', {},
    el('th', { scope: 'col' }, 'Demanda'),
    ...matriz.pessoas.map((p) => el('th', { scope: 'col', class: 'pessoa' }, p.nome)),
    el('th', { scope: 'col' }, 'Agora'));
  const linhas = matriz.linhas.map(({ demanda, papeis }) => {
    const abrir = el('button', { type: 'button', class: 'link-demanda' },
      el('span', { class: 'mono' }, demanda.codigo), ` ${demanda.titulo}`);
    abrir.addEventListener('click', () => {
      fechar();
      pedirPainelDaDemanda(demanda.id);
      window.location.hash = '#demandas';
    });
    return el('tr', { class: demanda.status === 'concluida' ? 'concluida' : undefined },
      el('th', { scope: 'row' }, abrir,
        el('div', { class: 'meta' }, `Prazo ${dataCurta(demanda.prazo)} · ${NOME_DO_ALCANCE[demanda.alcance]}`)),
      ...matriz.pessoas.map((p) => {
        const papel = papeis[p.id];
        return el('td', { class: 'papel' }, papel ? seloDePapel(papel) : el('span', { class: 'sem-papel', 'aria-label': 'Sem papel' }, '·'));
      }),
      el('td', { class: 'agora' }, seloDeStatus(demanda.status), el('div', { class: 'meta' }, descreverComQuem(demanda))));
  });

  return [
    el('div', { class: 'legenda-raci' },
      el('span', {}, seloDePapel('R'), ' Executa'),
      el('span', {}, seloDePapel('A'), ' Aprova'),
      el('span', {}, seloDePapel('A/R'), ' Executa e aprova'),
      el('span', {}, seloDePapel('I'), ' Informado na conclusão')),
    el('div', { class: 'tabela-rolavel' }, el('table', { class: 'matriz-raci' }, el('thead', {}, cabecalho), el('tbody', {}, ...linhas))),
    el('p', { class: 'dica' }, 'A matriz mostra as demandas que você enxerga. Clique numa demanda para abrir os detalhes.'),
  ];
}

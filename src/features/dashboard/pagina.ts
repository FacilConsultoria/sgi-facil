// Tela Inicial: saudação com o escopo da pessoa, quatro números e as listas do que pede atenção agora
// (entregas, validações, reuniões, últimos lançamentos e pedidos de acesso). Só leitura; cada item leva à tela do módulo.
import type { ContextoDaSessao } from '../../app/sessao';
import { descreverEscopo, primeiroNome } from '../../lib/perfil';
import { hojeEmSaoPaulo } from '../../lib/datas';
import type { DemandaVisivel, LancamentoVisivel, ReuniaoVisivel, SolicitacaoVisivel } from '../../types/database';
import { el, substituir } from '../../ui/dom';
import { montarRecarregavel } from '../../ui/recarregavel';
import { abrirMeusDados, EVENTO_DADOS_SALVOS } from '../dadospessoais/janela';
import { pedirPainelDaDemanda } from '../demandas/pagina';
import { estaAtrasada } from '../demandas/regras';
import { comSinal, descreverLancamento, NOME_DO_TIPO_DE_LANCAMENTO } from '../pontuacao/regras';
import { nomeDoPublico } from '../reunioes/regras';
import { carregarInicio, type DadosDoInicio } from './dados';
import { blocoDeRecados } from './recados';
import {
  aguardandoValidacao, descreverPrazo, descreverQuando, descreverValidadeDoPedido, indicadoresDoInicio, LIMITE_DE_ENTREGAS,
  LIMITE_DE_REUNIOES, minhasDemandasAbertas, pedidosParaDecidir, proximasReunioes, ultimosLancamentos,
} from './regras';

export function paginaDashboard(destino: HTMLElement, contexto: ContextoDaSessao): void {
  const { perfil, tituloDaArea } = contexto;
  const corpo = el('div', {});
  substituir(destino,
    el('section', { class: 'cab' },
      el('div', {},
        el('h1', {}, `Olá, ${primeiroNome(perfil.nome)}`),
        el('p', { class: 'sub' }, descreverEscopo(perfil, tituloDaArea)))),
    corpo);

  montarRecarregavel<DadosDoInicio>(corpo, {
    carregar: () => carregarInicio(perfil.id),
    operacao: 'Carregar a Tela Inicial',
    textoDeCarregando: 'Carregando seu painel…',
    desenhar: (dados, recarregar) => desenharInicio(dados, contexto, hojeEmSaoPaulo(), destino, recarregar),
  });
}

/** Aviso de dados pessoais pendentes; some sozinho quando a pessoa salva (pela janela do aviso ou do menu). */
function avisoDeDadosPendentes(contexto: ContextoDaSessao, pai: HTMLElement): HTMLElement {
  const preencher = el('button', { type: 'button', class: 'btn prim' }, 'Preencher agora');
  preencher.addEventListener('click', () => void abrirMeusDados(pai, contexto.perfil));
  const aviso = el('section', { class: 'aviso-dados' },
    el('div', {},
      el('b', {}, 'Seus dados pessoais estão pendentes'),
      el('p', { class: 'dica' }, 'Nome completo, RGA, CPF, data de nascimento e gênero. Leva um minuto e evita pedirmos de novo.')),
    preencher);
  const aoSalvar = (): void => {
    window.removeEventListener(EVENTO_DADOS_SALVOS, aoSalvar);
    aviso.remove();
  };
  window.addEventListener(EVENTO_DADOS_SALVOS, aoSalvar);
  return aviso;
}

function desenharInicio(
  dados: DadosDoInicio, contexto: ContextoDaSessao, hoje: string, pai: HTMLElement, recarregar: () => Promise<void>,
): HTMLElement[] {
  const { perfil } = contexto;
  const minhas = minhasDemandasAbertas(dados.demandas, perfil.id);
  const proximas = proximasReunioes(dados.reunioes, hoje);
  const validar = aguardandoValidacao(dados.demandas);
  const lancamentos = ultimosLancamentos(dados.lancamentos);
  const pedidos = pedidosParaDecidir(dados.solicitacoes);
  const recados = blocoDeRecados(dados, pai, recarregar);

  const indicadores = indicadoresDoInicio({ minhas, ranking: dados.ranking, proximas, meuId: perfil.id, hoje });
  const permissoes = [
    perfil.pode_cadastrar_pessoas && 'cadastrar pessoas',
    perfil.pode_ajustar_pontos && 'ajustar pontuações',
    perfil.pode_editar_regras && 'alterar as regras de pontuação',
  ].filter((item): item is string => Boolean(item));

  return [
    ...(perfil.dados_pendentes ? [avisoDeDadosPendentes(contexto, pai)] : []),
    ...(recados ? [recados] : []),
    el('div', { class: 'kpis' }, ...indicadores.map((i) =>
      el('div', { class: i.alerta ? 'kpi alerta' : 'kpi' }, el('span', {}, i.titulo), el('b', {}, i.valor), el('small', {}, i.detalhe)))),
    el('div', { class: 'duas' },
      bloco('Suas próximas entregas', minhas.slice(0, LIMITE_DE_ENTREGAS).map((d) => itemDeDemanda(d, hoje)), 'Nenhuma demanda aberta com você.'),
      perfil.papel === 'membro'
        ? null
        : bloco('Aguardando sua validação', validar.slice(0, LIMITE_DE_ENTREGAS).map((d) => itemDeDemanda(d, hoje)), 'Nada em revisão no seu escopo.',
          'Concluir uma demanda gera os pontos de entrega para os executores.'),
      bloco('Próximas reuniões', proximas.slice(0, LIMITE_DE_REUNIOES).map((r) => itemDeReuniao(r, dados)), 'Nenhuma reunião agendada para você.'),
      bloco('Seus últimos lançamentos', lancamentos.map(itemDeLancamento), 'Sem lançamentos ainda.'),
      pedidos.length ? bloco('Pedidos de acesso para decidir', pedidos.map(itemDePedido), '') : null),
    ...(permissoes.length ? [el('p', { class: 'meta' }, `Seu perfil também permite ${permissoes.join(', ')}.`)] : []),
  ];
}

function bloco(titulo: string, itens: HTMLElement[], vazio: string, dica?: string): HTMLElement {
  return el('section', { class: 'bloco' },
    el('h2', {}, titulo),
    itens.length ? el('ul', { class: 'itens' }, ...itens) : el('p', { class: 'vazio' }, vazio),
    itens.length && dica ? el('p', { class: 'dica' }, dica) : null);
}

function item(titulo: string, detalhe: HTMLElement | string, lado: HTMLElement, aoClicar?: () => void): HTMLElement {
  const conteudo = [
    el('div', {}, el('div', { class: 'item-tit' }, titulo), el('div', { class: 'meta' }, detalhe)),
    lado,
  ];
  if (!aoClicar) return el('li', {}, el('div', { class: 'item estatico' }, ...conteudo));
  const botao = el('button', { type: 'button', class: 'item' }, ...conteudo);
  botao.addEventListener('click', aoClicar);
  return el('li', {}, botao);
}

function itemDeDemanda(demanda: DemandaVisivel, hoje: string): HTMLElement {
  return item(
    demanda.titulo,
    el('span', {}, el('span', { class: 'mono' }, demanda.codigo), ` · ${demanda.projeto_nome}`),
    el('span', { class: estaAtrasada(demanda, hoje) ? 'lado atrasada' : 'lado' }, descreverPrazo(demanda, hoje)),
    () => {
      pedirPainelDaDemanda(demanda.id);
      window.location.hash = '#demandas';
    });
}

function itemDeReuniao(reuniao: ReuniaoVisivel, dados: DadosDoInicio): HTMLElement {
  return item(
    reuniao.titulo,
    nomeDoPublico(reuniao, dados.publicos),
    el('span', { class: 'lado' }, descreverQuando(reuniao)),
    () => { window.location.hash = '#reunioes'; });
}

function itemDeLancamento(lancamento: LancamentoVisivel): HTMLElement {
  const classe = lancamento.valor > 0 ? 'lado pts pos' : lancamento.valor < 0 ? 'lado pts neg' : 'lado pts';
  return item(
    NOME_DO_TIPO_DE_LANCAMENTO[lancamento.tipo],
    descreverLancamento(lancamento),
    el('span', { class: classe }, comSinal(lancamento.valor)));
}

function itemDePedido(pedido: SolicitacaoVisivel): HTMLElement {
  return item(
    pedido.alvo_nome,
    pedido.justificativa,
    el('span', { class: 'lado' }, descreverValidadeDoPedido(pedido)),
    () => { window.location.hash = '#autorizacoes'; });
}

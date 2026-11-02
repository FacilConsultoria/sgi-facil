// Acessos por exceção: pedir acesso a um projeto ou demanda fora do escopo, decidir pedidos e revogar acessos.
// Mostra só o que a visão solicitacoes_visiveis devolve; quem pode agir vem dos indicadores do banco.
import { dataEHora } from '../../lib/datas';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import { plural } from '../../lib/texto';
import { presidenteOuVice } from '../../lib/tratamento';
import type { SolicitacaoVisivel } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { el, substituir } from '../../ui/dom';
import { executarAcao, linhaDeErro } from '../../ui/formulario';
import { carregarAcessos, decidirPedido, revogarAcesso } from './dados';
import { abrirPedidoDeAcesso, abrirPedidoDeAvalDeDecisao, type ContextoDosAcessos } from './pedido-de-acesso';
import { descreverValidade, NOME_DA_SITUACAO, separarSolicitacoes, tituloDoPedido } from './regras';

/** Monta o conteúdo de Acessos dentro de `destino` (a página Autorizações cuida do título e das abas). */
export function montarAcessos(destino: HTMLElement): void {
  // o conteúdo é redesenhado a cada recarga; janelas ficam em `destino`, fora dele
  const conteudo = el('div', {});
  substituir(destino, conteudo);

  const recarregar = async (): Promise<void> => {
    try {
      const dados = await carregarAcessos();
      // a pessoa pode ter trocado de aba enquanto os dados chegavam
      if (destino.isConnected) substituir(conteudo, ...desenhar({ pagina: destino, dados, recarregar }));
    } catch (erro: unknown) {
      registrarErro('Carregar acessos', erro);
      if (!destino.isConnected) return;
      const tentar = el('button', { type: 'button', class: 'btn' }, 'Tentar de novo');
      tentar.addEventListener('click', () => void recarregar());
      substituir(conteudo, el('section', { class: 'bloco' }, el('p', {}, mensagemParaUsuario(erro)), el('div', { class: 'linha' }, tentar)));
    }
  };

  substituir(conteudo, el('p', { class: 'meta' }, 'Carregando acessos…'));
  void recarregar();
}

function desenhar(contexto: ContextoDosAcessos): HTMLElement[] {
  const { dados } = contexto;
  const grupos = separarSolicitacoes(dados.solicitacoes);
  const lista = (itens: readonly SolicitacaoVisivel[], vazio: string): HTMLElement =>
    itens.length
      ? el('div', { class: 'lista' }, ...itens.map((s) => cartaoDoPedido(s, contexto)))
      : el('p', { class: 'vazio' }, vazio);
  const secao = (titulo: string, itens: readonly SolicitacaoVisivel[], vazio: string): HTMLElement =>
    el('section', { class: 'secao' }, el('h2', {}, `${titulo} · ${plural(itens.length, 'pedido', 'pedidos')}`), lista(itens, vazio));

  const pedir = el('button', { type: 'button', class: 'btn prim' }, 'Pedir acesso');
  pedir.addEventListener('click', () => abrirPedidoDeAcesso(contexto));
  return [
    el('div', { class: 'linha acoes-da-aba' },
      el('p', { class: 'dica' }, 'Acesso por exceção: libera a consulta a um projeto ou demanda fora do escopo de uma pessoa, por até 90 dias.'),
      dados.beneficiarios.length ? pedir : null),
    secao('Para você decidir', grupos.paraDecidir, 'Nenhum pedido aguardando a sua decisão.'),
    secao('Aguardando outras pessoas', grupos.pendentes, 'Nenhum outro pedido pendente.'),
    secao('Acessos vigentes', grupos.vigentes, 'Nenhum acesso por exceção em vigor.'),
    secao('Encerrados', grupos.encerrados, 'Nenhum pedido encerrado ainda.'),
  ];
}

function cartaoDoPedido(solicitacao: SolicitacaoVisivel, contexto: ContextoDosAcessos): HTMLElement {
  const { nomeDe } = contexto.dados;
  const cartao = el('article', { class: 'aval' },
    el('div', { class: 'linha selos' },
      el('span', { class: 'chip' }, solicitacao.alvo === 'projeto' ? 'Projeto' : 'Demanda'),
      el('span', { class: `chip acesso-${solicitacao.situacao}` }, NOME_DA_SITUACAO[solicitacao.situacao]),
      solicitacao.alvo_restrito ? el('span', { class: 'chip restrito' }, 'Restrito à Presidência') : null),
    el('p', { class: 'aval-resumo' }, tituloDoPedido(nomeDe(solicitacao.beneficiario), solicitacao.alvo_nome)),
    el('p', {}, solicitacao.justificativa),
    el('p', { class: 'meta' },
      `Pedido por ${nomeDe(solicitacao.solicitante)} em ${dataEHora(solicitacao.criado_em)} · ${descreverValidade(solicitacao)}`));

  if (solicitacao.decidido_por && solicitacao.decidido_em) {
    const verbo = solicitacao.status === 'negada' ? 'Negado' : 'Aprovado';
    cartao.append(el('p', { class: 'meta' },
      `${verbo} por ${nomeDe(solicitacao.decidido_por)} em ${dataEHora(solicitacao.decidido_em)}${solicitacao.nota ? `: ${solicitacao.nota}` : ''}`));
  }
  if (solicitacao.revogado_por && solicitacao.revogado_em) {
    cartao.append(el('p', { class: 'meta' }, `Revogado por ${nomeDe(solicitacao.revogado_por)} em ${dataEHora(solicitacao.revogado_em)}`));
  }

  if (solicitacao.pode_aprovar) cartao.append(areaDeDecisao(solicitacao, contexto));
  else if (solicitacao.pode_pedir_aval) cartao.append(areaDeAval(solicitacao, contexto));
  if (solicitacao.pode_revogar) cartao.append(areaDeRevogacao(solicitacao, contexto));
  return cartao;
}

function areaDeDecisao(solicitacao: SolicitacaoVisivel, contexto: ContextoDosAcessos): HTMLElement {
  const nota = el('textarea', { id: `nota-${solicitacao.id}`, class: 'curto', placeholder: 'Observação (opcional)' });
  const aprovar = el('button', { type: 'button', class: 'btn prim' }, 'Aprovar');
  const negar = el('button', { type: 'button', class: 'btn perigo' }, 'Negar');
  const erro = linhaDeErro();
  const decidir = (aprovado: boolean, botao: HTMLButtonElement): void => {
    void executarAcao({
      botao, erro, operacao: aprovado ? 'Aprovar acesso' : 'Negar acesso',
      acao: () => decidirPedido(solicitacao.id, aprovado, nota.value.trim()),
    }).then(async (deuCerto) => {
      if (!deuCerto) return;
      mostrarAviso(aprovado ? 'Acesso aprovado' : 'Pedido negado');
      await contexto.recarregar();
    });
  };
  aprovar.addEventListener('click', () => decidir(true, aprovar));
  negar.addEventListener('click', () => decidir(false, negar));
  return el('div', { class: 'form' },
    el('label', { for: nota.id, class: 'sr' }, 'Observação'), nota, erro.elemento,
    el('div', { class: 'linha' }, aprovar, negar));
}

function areaDeAval(solicitacao: SolicitacaoVisivel, contexto: ContextoDosAcessos): HTMLElement {
  const aprovar = el('button', { type: 'button', class: 'btn prim' }, 'Pedir aval para aprovar');
  const negar = el('button', { type: 'button', class: 'btn perigo' }, 'Pedir aval para negar');
  aprovar.addEventListener('click', () => abrirPedidoDeAvalDeDecisao(contexto, solicitacao, true));
  negar.addEventListener('click', () => abrirPedidoDeAvalDeDecisao(contexto, solicitacao, false));
  return el('div', { class: 'form' },
    el('p', { class: 'dica' }, `Como Assessoria de Presidência, a sua decisão sobre acessos por exceção depende do aval ${presidenteOuVice('de')}.`),
    el('div', { class: 'linha' }, aprovar, negar));
}

/** Revogar em dois passos: o acesso some na hora para quem o recebeu. */
function areaDeRevogacao(solicitacao: SolicitacaoVisivel, contexto: ContextoDosAcessos): HTMLElement {
  const area = el('div', { class: 'linha' });
  const erro = linhaDeErro();
  const revogar = el('button', { type: 'button', class: 'btn perigo' }, 'Revogar acesso');
  const confirmar = el('button', { type: 'button', class: 'btn perigo' }, 'Confirmar revogação');
  const cancelar = el('button', { type: 'button', class: 'btn' }, 'Cancelar');
  const mostrarBotao = (): void => substituir(area, revogar);
  revogar.addEventListener('click', () => substituir(area, el('span', { class: 'dica' }, 'A pessoa perde o acesso na hora.'), confirmar, cancelar));
  cancelar.addEventListener('click', mostrarBotao);
  confirmar.addEventListener('click', () => {
    void executarAcao({
      botao: confirmar, erro, operacao: 'Revogar acesso',
      acao: () => revogarAcesso(solicitacao.id),
    }).then(async (deuCerto) => {
      if (!deuCerto) {
        mostrarBotao();
        return;
      }
      mostrarAviso('Acesso revogado');
      await contexto.recarregar();
    });
  });
  mostrarBotao();
  return el('div', { class: 'form' }, area, erro.elemento);
}

// Recados internos na Tela Inicial: a equipe lê os mais recentes; quem tem permissão (indicada pelo banco em
// destinos_de_recado) publica, com prazo de exibição opcional. Recado para toda a equipe pedido por diretoria
// espera a autorização da Presidência: quem autoriza vê os pedidos aqui; quem pediu acompanha a resposta.
import { hojeEmSaoPaulo } from '../../lib/datas';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import { mostrarAviso } from '../../ui/aviso';
import { el } from '../../ui/dom';
import { abrirJanela, campo, ligarEnvio, linhaDeErro, rodapeDaJanela } from '../../ui/formulario';
import type { DestinoDeRecado, RecadoDoPainel } from '../../types/database';
import { EVENTO_NOTIFICACOES_MUDARAM } from '../notificacoes/sino';
import { decidirRecado, publicarRecado, retirarRecado, type DadosDoInicio } from './dados';
import {
  descreverRecado, lerDestino, LIMITE_DO_TEXTO_DO_RECADO, LIMITE_DO_TITULO_DO_RECADO, meusPedidosDeRecado, recadosParaAutorizar,
  recadosRecentes, rotuloDoDestino, validarRecado, valorDoDestino,
} from './regras';

const LIMITE_DO_MOTIVO = 300;

/** Depois de mexer num recado: recarrega a Tela Inicial e avisa o sino. */
function depoisDeMudar(recarregar: () => Promise<void>): Promise<void> {
  window.dispatchEvent(new CustomEvent(EVENTO_NOTIFICACOES_MUDARAM));
  return recarregar();
}

/** O bloco "Recados internos"; só aparece quando há o que ler, decidir ou acompanhar, ou quando a pessoa pode publicar. */
export function blocoDeRecados(dados: DadosDoInicio, meuId: string, pai: HTMLElement, recarregar: () => Promise<void>): HTMLElement | null {
  const hoje = hojeEmSaoPaulo();
  const recentes = recadosRecentes(dados.recados, hoje);
  const paraAutorizar = recadosParaAutorizar(dados.recados);
  const meusPedidos = meusPedidosDeRecado(dados.recados, meuId, hoje);
  const podePublicar = dados.destinosDeRecado.length > 0;
  if (recentes.length === 0 && paraAutorizar.length === 0 && meusPedidos.length === 0 && !podePublicar) return null;

  const novo = el('button', { type: 'button', class: 'btn prim peq' }, 'Novo recado');
  novo.addEventListener('click', () => abrirNovoRecado(dados.destinosDeRecado, pai, recarregar));

  return el('section', { class: 'bloco recados', 'aria-labelledby': 'recados-titulo' },
    el('div', { class: 'recados-cab' }, el('h2', { id: 'recados-titulo' }, 'Recados internos'), podePublicar ? novo : null),
    paraAutorizar.length
      ? el('div', { class: 'recados-grupo' },
        el('h3', {}, 'Aguardando sua autorização'),
        el('ul', { class: 'lista-recados' }, ...paraAutorizar.map((recado) => itemParaAutorizar(recado, pai, recarregar))))
      : null,
    meusPedidos.length
      ? el('div', { class: 'recados-grupo' },
        el('h3', {}, 'Seus pedidos para toda a equipe'),
        el('ul', { class: 'lista-recados' }, ...meusPedidos.map((recado) => itemDeRecado(recado, recarregar))))
      : null,
    recentes.length
      ? el('ul', { class: 'lista-recados' }, ...recentes.map((recado) => itemDeRecado(recado, recarregar)))
      : el('p', { class: 'vazio' }, podePublicar
        ? 'Nenhum recado no ar. Use “Novo recado” para avisar a equipe.'
        : 'Nenhum recado no ar.'));
}

/** Título do recado e, nos pedidos, o selo da situação. */
function tituloDoRecado(recado: RecadoDoPainel): HTMLElement {
  if (recado.situacao === 'pendente') {
    return el('div', { class: 'item-tit' }, recado.titulo, ' ', el('span', { class: 'selo-recado pendente' }, 'Aguardando autorização'));
  }
  if (recado.situacao === 'recusado') {
    return el('div', { class: 'item-tit' }, recado.titulo, ' ', el('span', { class: 'selo-recado recusado' }, 'Não autorizado'));
  }
  return el('div', { class: 'item-tit' }, recado.titulo);
}

function itemDeRecado(recado: RecadoDoPainel, recarregar: () => Promise<void>): HTMLElement {
  // em pedido sem resposta, "Retirar" desiste do pedido
  const retirar = recado.pode_retirar && recado.situacao !== 'recusado'
    ? el('button', { type: 'button', class: 'btn peq' }, recado.situacao === 'pendente' ? 'Desistir' : 'Retirar')
    : null;
  retirar?.addEventListener('click', () => {
    retirar.disabled = true;
    retirarRecado(recado.id)
      .then(() => {
        mostrarAviso(recado.situacao === 'pendente' ? 'Pedido cancelado' : 'Recado retirado');
        return depoisDeMudar(recarregar);
      })
      .catch((erro: unknown) => {
        registrarErro('Retirar recado', erro);
        mostrarAviso(mensagemParaUsuario(erro), 'erro');
        retirar.disabled = false;
      });
  });
  return el('li', { class: `recado ${recado.situacao}` },
    el('div', { class: 'recado-topo' },
      el('div', {},
        tituloDoRecado(recado),
        el('div', { class: 'meta' }, descreverRecado(recado))),
      retirar),
    el('p', { class: 'recado-texto' }, recado.texto),
    recado.situacao === 'recusado' && recado.motivo_recusa
      ? el('p', { class: 'recado-motivo' }, `Motivo: ${recado.motivo_recusa}`)
      : null);
}

function itemParaAutorizar(recado: RecadoDoPainel, pai: HTMLElement, recarregar: () => Promise<void>): HTMLElement {
  const autorizar = el('button', { type: 'button', class: 'btn prim peq' }, 'Autorizar');
  const recusar = el('button', { type: 'button', class: 'btn peq' }, 'Recusar');
  autorizar.addEventListener('click', () => {
    autorizar.disabled = true;
    recusar.disabled = true;
    decidirRecado(recado.id, true, null)
      .then(() => {
        mostrarAviso('Recado autorizado e enviado para toda a equipe');
        return depoisDeMudar(recarregar);
      })
      .catch((erro: unknown) => {
        registrarErro('Autorizar recado', erro);
        mostrarAviso(mensagemParaUsuario(erro), 'erro');
        autorizar.disabled = false;
        recusar.disabled = false;
      });
  });
  recusar.addEventListener('click', () => abrirRecusa(recado, pai, recarregar));
  return el('li', { class: 'recado pendente' },
    el('div', { class: 'recado-topo' },
      el('div', {}, el('div', { class: 'item-tit' }, recado.titulo), el('div', { class: 'meta' }, descreverRecado(recado))),
      el('div', { class: 'linha' }, recusar, autorizar)),
    el('p', { class: 'recado-texto' }, recado.texto));
}

function abrirRecusa(recado: RecadoDoPainel, pai: HTMLElement, recarregar: () => Promise<void>): void {
  abrirJanela(pai, 'recusar-recado-titulo', 'Recusar recado', (fechar) => {
    const motivo = el('textarea', { id: 'rec-motivo', rows: '3', maxlength: String(LIMITE_DO_MOTIVO) });
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Recusar');
    const erro = linhaDeErro();
    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        el('p', {}, el('strong', {}, recado.titulo), ` · pedido de ${recado.autor_nome}`),
        campo('Motivo (opcional, quem pediu vê)', motivo),
        erro.elemento),
      rodapeDaJanela(fechar, botao));
    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Recusar recado',
      validar: () => (motivo.value.trim().length > LIMITE_DO_MOTIVO ? `O motivo pode ter até ${LIMITE_DO_MOTIVO} caracteres.` : null),
      acao: () => decidirRecado(recado.id, false, motivo.value.trim() || null),
      depois: async () => {
        fechar();
        mostrarAviso('Recado recusado');
        await depoisDeMudar(recarregar);
      },
    });
    queueMicrotask(() => motivo.focus());
    return formulario;
  });
}

function abrirNovoRecado(destinos: readonly DestinoDeRecado[], pai: HTMLElement, recarregar: () => Promise<void>): void {
  abrirJanela(pai, 'novo-recado-titulo', 'Novo recado', (fechar) => {
    const hoje = hojeEmSaoPaulo();
    const destino = el('select', { id: 'rec-destino' },
      ...destinos.map((d) => el('option', { value: valorDoDestino(d) }, rotuloDoDestino(d))));
    const titulo = el('input', { type: 'text', id: 'rec-titulo', maxlength: String(LIMITE_DO_TITULO_DO_RECADO), autocomplete: 'off' });
    const texto = el('textarea', { id: 'rec-texto', rows: '5', maxlength: String(LIMITE_DO_TEXTO_DO_RECADO) });
    const visivelAte = el('input', { type: 'date', id: 'rec-prazo', min: hoje });
    const avisoDeAutorizacao = el('p', { class: 'dica aviso-autorizacao' },
      'Para toda a equipe, o recado vai antes para a autorização da Presidência, da Vice-Presidência ou da Assessoria. Só depois de autorizado ele aparece e avisa as pessoas.');
    const precisaAutorizar = (): boolean => destinos.some((d) => valorDoDestino(d) === destino.value && d.precisa_autorizacao);
    const mostrarAvisoDeAutorizacao = (): void => { avisoDeAutorizacao.hidden = !precisaAutorizar(); };
    destino.addEventListener('change', mostrarAvisoDeAutorizacao);
    mostrarAvisoDeAutorizacao();

    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Publicar');
    const erro = linhaDeErro();
    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        campo('Para quem', destino),
        avisoDeAutorizacao,
        campo('Título', titulo),
        campo('Recado', texto),
        campo('Mostrar até (opcional)', visivelAte),
        el('p', { class: 'dica' }, 'Depois desse dia o recado some da Tela Inicial e do sino. Sem data, ele fica na tela por 30 dias.'),
        erro.elemento),
      rodapeDaJanela(fechar, botao));

    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Publicar recado',
      validar: () => validarRecado({ titulo: titulo.value, texto: texto.value, destino: destino.value, visivelAte: visivelAte.value }, hojeEmSaoPaulo()),
      acao: () => {
        const alvo = lerDestino(destino.value);
        if (!alvo) throw new Error('Escolha para quem é o recado.');
        return publicarRecado({
          titulo: titulo.value.trim(), texto: texto.value.trim(), escopo: alvo.escopo, escopoId: alvo.escopoId, visivelAte: visivelAte.value || null,
        });
      },
      depois: async () => {
        const foiParaAutorizacao = precisaAutorizar();
        fechar();
        mostrarAviso(foiParaAutorizacao ? 'Recado enviado para autorização' : 'Recado publicado');
        await depoisDeMudar(recarregar);
      },
    });
    queueMicrotask(() => titulo.focus());
    return formulario;
  });
}

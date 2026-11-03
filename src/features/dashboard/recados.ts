// Recados internos na Tela Inicial: a equipe lê os mais recentes; quem tem permissão (indicada pelo banco em
// destinos_de_recado) publica, e quem publicou (ou a Presidência) pode retirar.
import { hojeEmSaoPaulo } from '../../lib/datas';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import { mostrarAviso } from '../../ui/aviso';
import { el } from '../../ui/dom';
import { abrirJanela, campo, ligarEnvio, linhaDeErro, rodapeDaJanela } from '../../ui/formulario';
import type { RecadoDoPainel } from '../../types/database';
import { publicarRecado, retirarRecado, type DadosDoInicio } from './dados';
import {
  descreverRecado, lerDestino, LIMITE_DO_TEXTO_DO_RECADO, LIMITE_DO_TITULO_DO_RECADO, recadosRecentes, rotuloDoDestino, validarRecado,
  valorDoDestino,
} from './regras';

/** O bloco "Recados internos"; só aparece quando há o que ler ou quando a pessoa pode publicar. */
export function blocoDeRecados(dados: DadosDoInicio, pai: HTMLElement, recarregar: () => Promise<void>): HTMLElement | null {
  const recentes = recadosRecentes(dados.recados, hojeEmSaoPaulo());
  const podePublicar = dados.destinosDeRecado.length > 0;
  if (recentes.length === 0 && !podePublicar) return null;

  const novo = el('button', { type: 'button', class: 'btn prim peq' }, 'Novo recado');
  novo.addEventListener('click', () => abrirNovoRecado(dados, pai, recarregar));

  return el('section', { class: 'bloco recados', 'aria-labelledby': 'recados-titulo' },
    el('div', { class: 'recados-cab' }, el('h2', { id: 'recados-titulo' }, 'Recados internos'), podePublicar ? novo : null),
    recentes.length
      ? el('ul', { class: 'lista-recados' }, ...recentes.map((recado) => itemDeRecado(recado, recarregar)))
      : el('p', { class: 'vazio' }, 'Nenhum recado nos últimos 30 dias. Use “Novo recado” para avisar a equipe.'));
}

function itemDeRecado(recado: RecadoDoPainel, recarregar: () => Promise<void>): HTMLElement {
  const retirar = recado.pode_retirar ? el('button', { type: 'button', class: 'btn peq' }, 'Retirar') : null;
  retirar?.addEventListener('click', () => {
    retirar.disabled = true;
    retirarRecado(recado.id)
      .then(() => {
        mostrarAviso('Recado retirado');
        return recarregar();
      })
      .catch((erro: unknown) => {
        registrarErro('Retirar recado', erro);
        mostrarAviso(mensagemParaUsuario(erro), 'erro');
        retirar.disabled = false;
      });
  });
  return el('li', { class: 'recado' },
    el('div', { class: 'recado-topo' },
      el('div', {}, el('div', { class: 'item-tit' }, recado.titulo), el('div', { class: 'meta' }, descreverRecado(recado))),
      retirar),
    el('p', { class: 'recado-texto' }, recado.texto));
}

function abrirNovoRecado(dados: DadosDoInicio, pai: HTMLElement, recarregar: () => Promise<void>): void {
  abrirJanela(pai, 'novo-recado-titulo', 'Novo recado', (fechar) => {
    const destino = el('select', { id: 'rec-destino' },
      ...dados.destinosDeRecado.map((d) => el('option', { value: valorDoDestino(d) }, rotuloDoDestino(d))));
    const titulo = el('input', { type: 'text', id: 'rec-titulo', maxlength: String(LIMITE_DO_TITULO_DO_RECADO), autocomplete: 'off' });
    const texto = el('textarea', { id: 'rec-texto', rows: '5', maxlength: String(LIMITE_DO_TEXTO_DO_RECADO) });
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Publicar');
    const erro = linhaDeErro();
    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        campo('Para quem', destino),
        campo('Título', titulo),
        campo('Recado', texto),
        el('p', { class: 'dica' }, 'Quem estiver no público recebe a notificação no sino e vê o recado na Tela Inicial.'),
        erro.elemento),
      rodapeDaJanela(fechar, botao));

    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Publicar recado',
      validar: () => validarRecado({ titulo: titulo.value, texto: texto.value, destino: destino.value }),
      acao: () => {
        const alvo = lerDestino(destino.value);
        if (!alvo) throw new Error('Escolha para quem é o recado.');
        return publicarRecado({ titulo: titulo.value.trim(), texto: texto.value.trim(), escopo: alvo.escopo, escopoId: alvo.escopoId });
      },
      depois: async () => {
        fechar();
        mostrarAviso('Recado publicado');
        await recarregar();
      },
    });
    queueMicrotask(() => titulo.focus());
    return formulario;
  });
}

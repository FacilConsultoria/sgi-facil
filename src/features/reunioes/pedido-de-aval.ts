// Janela para pedir à Presidência ou à Vice-Presidência que aceitem justificar a falta de diretoria.
import { presidenteOuVice } from '../../lib/tratamento';
import { mostrarAviso } from '../../ui/aviso';
import { el } from '../../ui/dom';
import { abrirJanela, campo, ligarEnvio, linhaDeErro, rodapeDaJanela } from '../../ui/formulario';
import type { ContextoDeReunioes } from './contexto';
import { pedirAvalDeJustificativa } from './dados';
import { resumoDoPedidoDeJustificativa, validarMotivoDoAval } from './regras';

export function abrirPedidoDeAval(
  contexto: ContextoDeReunioes,
  reuniao: { id: string; titulo: string },
  pessoaId: string,
  depois: () => Promise<void>,
): void {
  const nome = contexto.dados.nomeDe(pessoaId);
  abrirJanela(contexto.pagina, 'pedido-aval-titulo', 'Pedir aval para justificar a falta', (fechar) => {
    const motivo = el('textarea', { id: 'pa-motivo', placeholder: 'Ex.: viagem a trabalho autorizada pela Presidência' });
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Enviar pedido');
    const erro = linhaDeErro();
    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        el('p', { class: 'dica' },
          `A falta de diretoria só vira justificada com o aval ${presidenteOuVice('de')}. O pedido de ${nome} na reunião “${reuniao.titulo}” fica registrado até a decisão; enquanto isso a reunião não pode ser encerrada.`),
        campo('Motivo', motivo),
        erro.elemento),
      rodapeDaJanela(fechar, botao));

    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Pedir aval de justificativa',
      validar: () => validarMotivoDoAval(motivo.value),
      acao: () => pedirAvalDeJustificativa(reuniao.id, pessoaId, resumoDoPedidoDeJustificativa(nome, reuniao.titulo, motivo.value)),
      depois: async () => {
        fechar();
        mostrarAviso('Pedido de aval enviado');
        await depois();
      },
    });
    queueMicrotask(() => motivo.focus());
    return formulario;
  });
}

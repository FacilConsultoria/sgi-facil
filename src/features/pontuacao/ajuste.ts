// Bloco "Ajuste manual" da pessoa selecionada. Quem pode ajustar lança direto; a Assessoria de Presidência,
// na própria pontuação, pede o aval da Presidente ou da Vice; os demais só leem o porquê de não poderem.
import type { ContextoDaSessao } from '../../app/sessao';
import { hojeEmSaoPaulo } from '../../lib/datas';
import { primeiroNome } from '../../lib/perfil';
import type { PessoaComPontuacao } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { el } from '../../ui/dom';
import { campo, ligarEnvio, linhaDeErro } from '../../ui/formulario';
import { lancarPontos, pedirAvalDeAjusteProprio, type NovoAjuste } from './dados';
import { LIMITE_DO_AJUSTE, resumoDoPedidoDeAjusteProprio, validarAjuste } from './regras';

type Modo = 'direto' | 'aval';

export function blocoDeAjuste(pessoa: PessoaComPontuacao, contexto: ContextoDaSessao, recarregar: () => Promise<void>): HTMLElement {
  if (pessoa.pode_ajustar) return formulario(pessoa, 'direto', recarregar);
  if (pessoa.pode_pedir_aval) return formulario(pessoa, 'aval', recarregar);
  // texto de apoio: a regra em si (quem pode) já veio pronta do banco
  const propriaPontuacao = pessoa.id === contexto.perfil.id && contexto.perfil.pode_ajustar_pontos;
  return el('div', { class: 'ajuste' },
    el('h2', {}, 'Ajuste manual'),
    el('p', { class: 'somente-leitura' }, propriaPontuacao
      ? 'Ninguém ajusta a própria pontuação. Peça à Presidência ou à Diretoria Administrativa.'
      : 'Só a Presidência e a Diretoria Administrativa (Gente e Gestão) lançam ajustes e desconsideram lançamentos. Se algo estiver errado, fale com a sua liderança.'));
}

function formulario(pessoa: PessoaComPontuacao, modo: Modo, recarregar: () => Promise<void>): HTMLElement {
  const hoje = hojeEmSaoPaulo();
  const tipo = el('select', { id: 'aj-tipo' },
    el('option', { value: 'ajuste' }, 'Ajuste'),
    el('option', { value: 'evento' }, 'Evento'));
  const valor = el('input', {
    type: 'number', id: 'aj-valor', step: '1', min: String(-LIMITE_DO_AJUSTE), max: String(LIMITE_DO_AJUSTE), placeholder: 'Ex.: −2 ou 3',
  });
  const data = el('input', { type: 'date', id: 'aj-data', value: hoje, max: hoje });
  const justificativa = el('textarea', { id: 'aj-just', placeholder: 'Explique por que este ajuste está sendo feito' });
  const erro = linhaDeErro();
  const botao = el('button', { type: 'submit', class: 'btn prim largo' },
    modo === 'direto' ? `Lançar para ${primeiroNome(pessoa.nome)}` : 'Pedir aval à Presidência');

  const form = el('form', { class: 'form', novalidate: true },
    campo('Tipo', tipo), campo('Valor de pontos', valor), campo('Data de referência', data), campo('Justificativa', justificativa),
    erro.elemento, botao);

  const ler = (): NovoAjuste => ({
    tipo: tipo.value === 'evento' ? 'evento' : 'ajuste',
    valor: Number(valor.value),
    data: data.value,
    justificativa: justificativa.value.trim(),
  });
  ligarEnvio({
    formulario: form, botao, erro,
    operacao: modo === 'direto' ? 'Lançar ajuste de pontos' : 'Pedir aval para ajustar a própria pontuação',
    validar: () => validarAjuste({ valor: valor.value, data: data.value, justificativa: justificativa.value }, hoje),
    acao: () => {
      const ajuste = ler();
      return modo === 'direto'
        ? lancarPontos(pessoa.id, ajuste)
        : pedirAvalDeAjusteProprio(ajuste, resumoDoPedidoDeAjusteProprio(ajuste.tipo, ajuste.valor, ajuste.data, ajuste.justificativa));
    },
    depois: async () => {
      mostrarAviso(modo === 'direto' ? 'Pontuação lançada' : 'Pedido de aval enviado');
      await recarregar();
    },
  });

  return el('div', { class: 'ajuste' },
    el('h2', {}, modo === 'direto' ? 'Ajuste manual' : 'Ajuste da própria pontuação'),
    el('p', { class: 'dica' }, modo === 'direto'
      ? 'Presidência e Diretoria Administrativa (Gente e Gestão) corrigem pontuações com justificativa. Ninguém ajusta a própria.'
      : 'Como Assessoria de Presidência, o ajuste da própria pontuação só vale depois que a Presidente ou a Vice aprovarem o pedido, na aba Avais de Autorizações.'),
    form);
}

// Lista de presença da reunião: quem organiza marca e encerra (as faltas viram lançamentos de pontos);
// os demais convocados só consultam a lista depois do encerramento. A falta de diretoria só vira
// "justificada" com o aval da Presidência ou da Vice-Presidência: quem organiza pede o aval daqui.
import { plural } from '../../lib/texto';
import { comInicialMaiuscula, presidenteOuVice } from '../../lib/tratamento';
import type { AvalVisivel, ConvocadoDaReuniao, Presenca, ReuniaoVisivel } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { el, substituir } from '../../ui/dom';
import { executarAcao, ligarEnvio, linhaDeErro } from '../../ui/formulario';
import type { ContextoDeReunioes } from './contexto';
import { carregarAvaisDaReuniao, carregarConvocados, carregarReuniao, encerrarReuniao, salvarPresencas } from './dados';
import { abrirPedidoDeAval } from './pedido-de-aval';
import {
  contarPresencas, NOME_DA_PRESENCA, opcoesDePresenca, podePedirAvalDeJustificativa, presencasParaEnvio,
  validarPresencasParaEncerrar,
} from './regras';
import { secaoQueCarrega, type Secao } from './secao';

export function secaoDePresenca(contexto: ContextoDeReunioes, reuniaoId: string, aoMudar: () => Promise<void>): Secao {
  const { nomeDe } = contexto.dados;
  return secaoQueCarrega({
    operacao: 'Carregar presença da reunião',
    carregar: async () => {
      const [reuniao, convocados, avais] = await Promise.all([
        carregarReuniao(reuniaoId), carregarConvocados(reuniaoId), carregarAvaisDaReuniao(reuniaoId),
      ]);
      return { reuniao, convocados, avais };
    },
    montar: ({ reuniao, convocados, avais }, atualizar) => {
      if (!reuniao) return [el('p', { class: 'dica' }, 'Esta reunião não está mais disponível.')];
      const ordenados = [...convocados].sort((a, b) => nomeDe(a.pessoa_id).localeCompare(nomeDe(b.pessoa_id), 'pt-BR'));
      if (reuniao.encerrada) return [listaDaReuniaoEncerrada(ordenados, nomeDe)];
      if (!reuniao.pode_gerir) {
        return [
          el('h3', {}, 'Lista de presença'),
          el('p', { class: 'dica' }, `${plural(ordenados.length, 'pessoa convocada', 'pessoas convocadas')}. A presença é registrada por quem organiza a reunião.`),
        ];
      }
      return [formularioDePresenca(contexto, reuniao, ordenados, avais, atualizar, aoMudar)];
    },
  });
}

function listaDaReuniaoEncerrada(convocados: readonly ConvocadoDaReuniao[], nomeDe: (id: string) => string): HTMLElement {
  const contagem = contarPresencas(convocados);
  return el('div', {},
    el('h3', {}, 'Lista de presença'),
    el('p', { class: 'meta' },
      `${plural(contagem.presente, 'presente', 'presentes')} · ${plural(contagem.justificada, 'justificada', 'justificadas')} · ${plural(contagem.falta, 'falta', 'faltas')}`),
    ...convocados.map((convocado) => el('div', { class: 'presenca' },
      el('span', {}, nomeDe(convocado.pessoa_id)),
      seloDePresenca(convocado.presenca))));
}

function seloDePresenca(presenca: Presenca | null): HTMLElement {
  if (presenca === null) return el('span', { class: 'chip' }, 'Sem registro');
  return el('span', { class: presenca === 'presente' ? 'chip ok' : presenca === 'falta' ? 'chip ruim' : 'chip' }, NOME_DA_PRESENCA[presenca]);
}

/** Situação do aval de uma pessoa nesta reunião: o mais recente decide o que aparece. */
function avalDaPessoa(avais: readonly AvalVisivel[], pessoaId: string): AvalVisivel | undefined {
  return avais.find((aval) => aval.payload.pessoa === pessoaId);
}

function formularioDePresenca(
  contexto: ContextoDeReunioes,
  reuniao: ReuniaoVisivel,
  convocados: readonly ConvocadoDaReuniao[],
  avais: readonly AvalVisivel[],
  atualizar: () => Promise<void>,
  aoMudar: () => Promise<void>,
): HTMLElement {
  const { nomeDe, papelDe } = contexto.dados;
  const campos = new Map<string, HTMLSelectElement>();
  const linhas = convocados.map((convocado) => {
    const id = `presenca-${convocado.pessoa_id}`;
    const ehDiretor = papelDe(convocado.pessoa_id) === 'diretor';
    const campo = el('select', { id },
      el('option', { value: '' }, 'Sem registro'),
      ...opcoesDePresenca(ehDiretor, reuniao.pode_justificar_diretoria, convocado.presenca).map((opcao) =>
        el('option', { value: opcao.id, selected: opcao.id === convocado.presenca, disabled: opcao.bloqueada }, opcao.nome)));
    campos.set(convocado.pessoa_id, campo);
    const linha = el('div', { class: 'presenca' }, el('label', { for: id }, nomeDe(convocado.pessoa_id)), campo);

    const aval = avalDaPessoa(avais, convocado.pessoa_id);
    const nota: HTMLElement[] = [];
    if (aval?.status === 'pendente') {
      nota.push(el('span', { class: 'chip s-revisao' }, 'Aval pendente'), el('span', { class: 'dica' }, `${comInicialMaiuscula(presidenteOuVice())} ainda vão decidir.`));
    } else {
      if (aval?.status === 'negado') nota.push(el('span', { class: 'chip ruim' }, 'Aval negado'), el('span', { class: 'dica' }, aval.nota ?? ''));
      if (podePedirAvalDeJustificativa(ehDiretor, reuniao.pode_justificar_diretoria, convocado.presenca)) {
        const pedir = el('button', { type: 'button', class: 'btn peq' }, 'Pedir aval para justificar');
        pedir.addEventListener('click', () => abrirPedidoDeAval(contexto, reuniao, convocado.pessoa_id, async () => {
          await atualizar();
          await aoMudar();
        }));
        nota.push(pedir);
      }
    }
    return nota.length ? el('div', { class: 'presenca-item' }, linha, el('div', { class: 'aval-linha' }, ...nota)) : linha;
  });
  const selecoes = (): Map<string, Presenca | ''> =>
    new Map([...campos].map(([pessoa, campo]) => [pessoa, campo.value as Presenca | '']));

  const todosPresentes = el('button', { type: 'button', class: 'btn' }, 'Marcar todos presentes');
  todosPresentes.addEventListener('click', () => {
    for (const campo of campos.values()) if (campo.value === '') campo.value = 'presente';
  });
  const salvar = el('button', { type: 'submit', class: 'btn' }, 'Salvar presença');
  const erro = linhaDeErro();
  const areaDeEncerramento = el('div', { class: 'linha' });

  const formulario = el('form', { novalidate: true },
    el('h3', {}, 'Lista de presença'),
    ...linhas,
    el('div', { class: 'linha acima' }, todosPresentes, salvar),
    erro.elemento,
    areaDeEncerramento);

  ligarEnvio({
    formulario, botao: salvar, erro,
    operacao: 'Salvar presença',
    acao: () => salvarPresencas(reuniao.id, presencasParaEnvio(selecoes())),
    depois: async () => {
      mostrarAviso('Presença salva');
      await atualizar();
    },
  });

  if (avais.some((aval) => aval.status === 'pendente')) {
    areaDeEncerramento.append(el('p', { class: 'dica' }, 'Há pedido de aval pendente nesta reunião. Ela só pode ser encerrada depois da decisão.'));
  } else if (reuniao.pode_encerrar) {
    montarEncerramento(areaDeEncerramento, reuniao, selecoes, erro, atualizar, aoMudar);
  } else {
    areaDeEncerramento.append(el('p', { class: 'dica' }, 'O encerramento (que lança as faltas como pontos) libera no dia da reunião.'));
  }
  return formulario;
}

/** Encerrar em dois passos: botão, depois confirmação, para ninguém lançar faltas por engano. */
function montarEncerramento(
  area: HTMLElement,
  reuniao: ReuniaoVisivel,
  selecoes: () => Map<string, Presenca | ''>,
  erro: ReturnType<typeof linhaDeErro>,
  atualizar: () => Promise<void>,
  aoMudar: () => Promise<void>,
): void {
  const encerrar = el('button', { type: 'button', class: 'btn prim' }, 'Encerrar e lançar faltas');
  const confirmar = el('button', { type: 'button', class: 'btn perigo' }, 'Confirmar encerramento');
  const cancelar = el('button', { type: 'button', class: 'btn' }, 'Cancelar');
  const aviso = el('span', { class: 'dica' }, 'As faltas viram lançamentos de pontos e a lista fica travada.');
  const mostrarBotao = (): void => substituir(area, encerrar);

  encerrar.addEventListener('click', () => {
    const problema = validarPresencasParaEncerrar(selecoes());
    if (problema) {
      erro.mostrar(problema);
      return;
    }
    erro.limpar();
    substituir(area, aviso, confirmar, cancelar);
  });
  cancelar.addEventListener('click', mostrarBotao);
  confirmar.addEventListener('click', () => {
    void executarAcao({
      botao: confirmar, erro, operacao: 'Encerrar reunião',
      acao: async () => {
        await salvarPresencas(reuniao.id, presencasParaEnvio(selecoes()));
        await encerrarReuniao(reuniao.id);
      },
    }).then(async (deuCerto) => {
      if (!deuCerto) {
        mostrarBotao();
        return;
      }
      mostrarAviso('Reunião encerrada e faltas lançadas');
      await atualizar();
      await aoMudar();
    });
  });
  mostrarBotao();
}

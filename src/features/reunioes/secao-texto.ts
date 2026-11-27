// Ata e transcrição da reunião: quem organiza escreve e cola; quem consegue ver a reunião lê.
import { dataCurta, dataEHora } from '../../lib/datas';
import { contarPalavras } from '../../lib/texto';
import { mostrarAviso } from '../../ui/aviso';
import { el, substituir } from '../../ui/dom';
import { ligarEnvio, linhaDeErro } from '../../ui/formulario';
import type { ContextoDeReunioes } from './contexto';
import { carregarReuniao, carregarTranscricao, salvarAta, salvarTranscricao } from './dados';
import { pedirNovaDemanda } from '../demandas/pagina';
import { lerRespostaDaIa, montarPedidoDaAta } from './ia';
import { NOME_DA_ORIGEM, validarTranscricao } from './regras';
import { secaoQueCarrega, type Secao } from './secao';

export function secaoDaAta(contexto: ContextoDeReunioes, reuniaoId: string, aoMudar: () => Promise<void>): Secao {
  const { nomeDe } = contexto.dados;
  return secaoQueCarrega({
    operacao: 'Carregar ata da reunião',
    carregar: async () => {
      const [reuniao, transcricao] = await Promise.all([carregarReuniao(reuniaoId), carregarTranscricao(reuniaoId)]);
      return { reuniao, transcricao };
    },
    montar: ({ reuniao, transcricao }, atualizar) => {
      if (!reuniao) return [];
      if (!reuniao.pode_gerir) {
        return [
          el('h3', {}, 'Ata'),
          reuniao.ata ? el('p', { class: 'ata' }, reuniao.ata) : el('p', { class: 'dica' }, 'Ata ainda não registrada.'),
        ];
      }
      const texto = el('textarea', { id: 'ata-texto', class: 'alto', placeholder: 'Decisões, encaminhamentos e responsáveis' }, reuniao.ata);
      const botao = el('button', { type: 'submit', class: 'btn' }, 'Salvar ata');
      const erro = linhaDeErro();
      const formulario = el('form', { class: 'form', novalidate: true },
        el('div', {}, el('label', { for: 'ata-texto' }, 'Ata'), texto),
        erro.elemento,
        el('div', { class: 'linha' }, botao,
          reuniao.ata_por && reuniao.ata_em
            ? el('span', { class: 'dica' }, `Última edição: ${nomeDe(reuniao.ata_por)} · ${dataEHora(reuniao.ata_em)}`)
            : null));
      ligarEnvio({
        formulario, botao, erro,
        operacao: 'Salvar ata',
        acao: () => salvarAta(reuniao.id, texto.value),
        depois: async () => {
          mostrarAviso('Ata salva');
          await atualizar();
          await aoMudar();
        },
      });
      return [formulario, blocoDaIa(reuniao, transcricao?.texto ?? null, texto)];
    },
  });
}

/**
 * Rascunho com a IA que a pessoa já usa (Claude, Gemini), sem custo: copia o pedido com a transcrição, recebe a
 * resposta colada (ou o resumo do Fathom), põe a ata no campo acima e lista os encaminhamentos para virar demanda.
 */
function blocoDaIa(reuniao: { titulo: string; data: string }, transcricao: string | null, campoDaAta: HTMLTextAreaElement): HTMLElement {
  const copiar = el('button', { type: 'button', class: 'btn peq', disabled: !transcricao }, 'Copiar pedido para a IA');
  copiar.addEventListener('click', () => {
    if (!transcricao) return;
    navigator.clipboard.writeText(montarPedidoDaAta(reuniao, transcricao))
      .then(() => mostrarAviso('Pedido copiado. Cole no Claude ou no Gemini.'))
      .catch(() => mostrarAviso('Não foi possível copiar. Tente de novo.', 'erro'));
  });
  const resposta = el('textarea', { id: 'ia-resposta', rows: '6', placeholder: 'Cole aqui a resposta da IA ou o resumo do Fathom' });
  const usar = el('button', { type: 'button', class: 'btn peq' }, 'Usar como rascunho');
  const lista = el('ul', { class: 'encaminhamentos' });
  usar.addEventListener('click', () => {
    const lida = lerRespostaDaIa(resposta.value);
    if (!lida.ata && lida.encaminhamentos.length === 0) {
      mostrarAviso('Cole a resposta antes.', 'erro');
      return;
    }
    if (lida.ata) campoDaAta.value = lida.ata;
    substituir(lista, ...lida.encaminhamentos.map((e) => {
      const criar = el('button', { type: 'button', class: 'btn peq' }, 'Criar demanda');
      criar.addEventListener('click', () => {
        pedirNovaDemanda({
          titulo: e.tarefa,
          descricao: `Encaminhamento da reunião "${reuniao.titulo}" (${dataCurta(reuniao.data)}).`,
          prazo: e.prazo,
          executorNome: e.responsavel,
        });
        window.location.hash = '#demandas';
      });
      return el('li', {},
        el('span', {}, el('strong', {}, e.tarefa),
          el('span', { class: 'meta' }, ` · ${e.responsavel ?? 'responsável a definir'} · ${e.prazo ? dataCurta(e.prazo) : 'sem prazo'}`)),
        criar);
    }));
    mostrarAviso(lida.encaminhamentos.length
      ? 'Rascunho colocado na ata. Confira e salve; os encaminhamentos estão abaixo.'
      : 'Rascunho colocado na ata. Confira e salve.');
  });
  return el('details', { class: 'rascunho-ia' },
    el('summary', {}, 'Rascunho com IA (Claude ou Gemini, sem custo)'),
    el('ol', { class: 'dica passos-ia' },
      el('li', {}, transcricao ? 'Copie o pedido (ele já leva a transcrição).' : 'Cole antes a transcrição do Fathom, logo abaixo; depois copie o pedido.'),
      el('li', {}, 'Cole no Claude ou no Gemini e copie a resposta.'),
      el('li', {}, 'Cole aqui e use como rascunho. Nada é salvo até você clicar em "Salvar ata".')),
    el('div', { class: 'linha' }, copiar),
    el('label', { for: 'ia-resposta', class: 'sr' }, 'Resposta da IA'),
    resposta,
    el('div', { class: 'linha' }, usar),
    lista);
}

export function secaoDaTranscricao(contexto: ContextoDeReunioes, reuniaoId: string, aoMudar: () => Promise<void>): Secao {
  const { nomeDe } = contexto.dados;
  return secaoQueCarrega({
    operacao: 'Carregar transcrição da reunião',
    classe: 'bloco-reu',
    carregar: async () => {
      const [reuniao, transcricao] = await Promise.all([carregarReuniao(reuniaoId), carregarTranscricao(reuniaoId)]);
      return { reuniao, transcricao };
    },
    montar: ({ reuniao, transcricao }, atualizar) => {
      const podeGerir = reuniao?.pode_gerir ?? false;
      const campoDeColar = (): HTMLElement => {
        const texto = el('textarea', { id: 'transcricao-texto', class: 'alto', placeholder: 'Cole aqui a transcrição do Fathom (ou de outra ferramenta)' });
        const botao = el('button', { type: 'submit', class: 'btn' }, transcricao ? 'Substituir transcrição' : 'Salvar transcrição');
        const erro = linhaDeErro();
        const formulario = el('form', { class: 'form', novalidate: true },
          el('label', { for: 'transcricao-texto', class: 'sr' }, 'Transcrição'),
          texto, erro.elemento, el('div', { class: 'linha' }, botao));
        ligarEnvio({
          formulario, botao, erro,
          operacao: 'Salvar transcrição',
          validar: () => validarTranscricao(texto.value),
          acao: () => salvarTranscricao(reuniaoId, texto.value),
          depois: async () => {
            mostrarAviso('Transcrição registrada');
            await atualizar();
            await aoMudar();
          },
        });
        return el('details', {}, el('summary', {}, transcricao ? 'Substituir por outra transcrição' : 'Colar transcrição manualmente'), formulario);
      };

      if (transcricao) {
        return [
          el('div', { class: 'linha' },
            el('h3', {}, 'Transcrição'),
            el('span', { class: transcricao.origem === 'meet' ? 'chip m-diretoria' : 'chip' }, NOME_DA_ORIGEM[transcricao.origem])),
          el('p', { class: 'meta' },
            `Recebida em ${dataEHora(transcricao.recebida_em)}${transcricao.registrado_por ? ` · registrada por ${nomeDe(transcricao.registrado_por)}` : ''} · ${contarPalavras(transcricao.texto)} palavras`),
          el('details', {}, el('summary', {}, 'Ler transcrição'), el('p', { class: 'ata' }, transcricao.texto)),
          podeGerir ? campoDeColar() : null,
        ];
      }
      return [
        el('h3', {}, 'Transcrição'),
        el('p', { class: 'dica' }, 'Nenhuma transcrição registrada.'),
        podeGerir ? campoDeColar() : null,
      ];
    },
  });
}

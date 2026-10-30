// Ata e transcrição da reunião: quem organiza escreve e cola; quem consegue ver a reunião lê.
import { dataEHora } from '../../lib/datas';
import { contarPalavras } from '../../lib/texto';
import { mostrarAviso } from '../../ui/aviso';
import { el } from '../../ui/dom';
import { ligarEnvio, linhaDeErro } from '../../ui/formulario';
import type { ContextoDeReunioes } from './contexto';
import { carregarReuniao, carregarTranscricao, salvarAta, salvarTranscricao } from './dados';
import { NOME_DA_ORIGEM, validarTranscricao } from './regras';
import { secaoQueCarrega, type Secao } from './secao';

export function secaoDaAta(contexto: ContextoDeReunioes, reuniaoId: string, aoMudar: () => Promise<void>): Secao {
  const { nomeDe } = contexto.dados;
  return secaoQueCarrega({
    operacao: 'Carregar ata da reunião',
    carregar: () => carregarReuniao(reuniaoId),
    montar: (reuniao, atualizar) => {
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
      return [formulario];
    },
  });
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
        const texto = el('textarea', { id: 'transcricao-texto', class: 'alto', placeholder: 'Cole aqui o texto exportado do Meet ou de outra ferramenta' });
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
        el('p', { class: 'dica' }, 'Com a integração ativa, a transcrição do Google Meet chega aqui ao fim da reunião.'),
        podeGerir ? campoDeColar() : null,
      ];
    },
  });
}

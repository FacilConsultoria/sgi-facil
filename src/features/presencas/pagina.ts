// Presenças: as reuniões da própria pessoa (com a opção de justificar a falta), as justificativas que ela decide
// e a frequência de quem ela acompanha. O que cada um vê e pode fazer chega pronto do banco.
import type { ContextoDaSessao } from '../../app/sessao';
import { dataCurta, hojeEmSaoPaulo } from '../../lib/datas';
import type { FrequenciaDaPessoa, JustificativaParaDecidir, MinhaPresenca } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { el, substituir } from '../../ui/dom';
import { abrirJanela, campo, executarAcao, ligarEnvio, linhaDeErro, rodapeDaJanela } from '../../ui/formulario';
import { montarRecarregavel } from '../../ui/recarregavel';
import { carregarPresencas, decidirJustificativa, justificarMinhaFalta, type DadosDePresencas } from './dados';
import { descreverTaxa, introducaoDaFrequencia, ordenarPorFrequencia, taxaDeFrequencia } from './regras';

const LIMITE_DE_REUNIOES = 20;

export function paginaPresencas(destino: HTMLElement, contexto: ContextoDaSessao): void {
  const trainee = contexto.perfil.papel === 'trainee';
  const subtitulo = el('p', { class: 'sub' }, trainee
    ? 'Sua presença em cada reunião. Faltou? Justifique em até 7 dias depois da reunião.'
    : 'Sua presença nas reuniões e a frequência de quem você acompanha.');
  const corpo = el('div', {});
  substituir(destino, el('section', { class: 'cab' }, el('div', {}, el('h1', {}, 'Presenças'), subtitulo)), corpo);

  montarRecarregavel<DadosDePresencas>(corpo, {
    carregar: carregarPresencas,
    operacao: 'Carregar presenças',
    textoDeCarregando: 'Carregando presenças…',
    desenhar: (dados, recarregar) => [
      ...(dados.paraDecidir.length ? [blocoParaDecidir(dados.paraDecidir, recarregar)] : []),
      blocoMinhasReunioes(dados.minhas, destino, recarregar),
      ...(trainee ? [] : [blocoFrequencia(dados.frequencia, contexto.perfil.id)]),
    ],
  });
}

function textoDaPresenca(m: MinhaPresenca, hoje: string): { texto: string; classe: string } {
  if (m.presenca === 'presente') return { texto: 'Presente', classe: 'ok' };
  if (m.presenca === 'justificada') return { texto: 'Falta justificada', classe: 'meta' };
  if (m.presenca === 'falta') return { texto: 'Falta', classe: 'alerta' };
  return { texto: m.data >= hoje ? 'Ainda vai acontecer' : 'Sem registro ainda', classe: 'meta' };
}

function textoDaJustificativa(m: MinhaPresenca): string {
  if (m.justificativa === 'pendente') return 'Justificativa enviada, aguardando decisão';
  if (m.justificativa === 'aceita') return 'Justificativa aceita';
  if (m.justificativa === 'recusada') return `Justificativa recusada${m.nota_da_decisao ? `: ${m.nota_da_decisao}` : ''}`;
  return '';
}

function blocoMinhasReunioes(minhas: readonly MinhaPresenca[], pai: HTMLElement, recarregar: () => Promise<void>): HTMLElement {
  const hoje = hojeEmSaoPaulo();
  const linhas = minhas.slice(0, LIMITE_DE_REUNIOES).map((m) => {
    const presenca = textoDaPresenca(m, hoje);
    let acao: HTMLElement | null = null;
    if (m.pode_justificar) {
      const antecipada = m.presenca === null && m.data >= hoje;
      const botao = el('button', { type: 'button', class: 'btn peq' }, antecipada ? 'Avisar ausência' : 'Justificar falta');
      botao.addEventListener('click', () => abrirJustificativa(pai, m, antecipada, recarregar));
      acao = botao;
    }
    return el('tr', {},
      el('td', {}, dataCurta(m.data)),
      el('td', {}, m.titulo),
      el('td', { class: presenca.classe }, presenca.texto),
      el('td', { class: 'meta' }, textoDaJustificativa(m)),
      el('td', {}, acao));
  });
  return el('section', { class: 'bloco minhas-presencas' },
    el('h2', {}, 'Suas reuniões'),
    linhas.length
      ? el('div', { class: 'tab-wrap' }, el('table', { class: 'tabela' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Data'), el('th', {}, 'Reunião'), el('th', {}, 'Presença'), el('th', {}, 'Justificativa'), el('th', {}, ''))),
        el('tbody', {}, ...linhas)))
      : el('p', { class: 'vazio' }, 'Você ainda não foi convocado para nenhuma reunião.'));
}

function abrirJustificativa(pai: HTMLElement, m: MinhaPresenca, antecipada: boolean, recarregar: () => Promise<void>): void {
  abrirJanela(pai, 'justificar-titulo', antecipada ? 'Avisar ausência' : 'Justificar falta', (fechar) => {
    const motivo = el('textarea', { id: 'jf-motivo', maxlength: '500', rows: '4', placeholder: 'Ex.: prova da faculdade no mesmo horário' });
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Enviar');
    const erro = linhaDeErro();
    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        el('p', {}, el('strong', {}, m.titulo), ` · ${dataCurta(m.data)}`),
        campo('Motivo', motivo),
        el('p', { class: 'dica' }, 'Quem organiza a reunião aceita ou recusa. Aceita, a falta não tira pontos.'),
        erro.elemento),
      rodapeDaJanela(fechar, botao));
    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Justificar falta',
      validar: () => {
        const texto = motivo.value.trim();
        if (texto.length < 10) return 'Explique o motivo em pelo menos 10 caracteres.';
        return texto.length > 500 ? 'O motivo tem no máximo 500 caracteres.' : null;
      },
      acao: () => justificarMinhaFalta(m.reuniao_id, motivo.value.trim()),
      depois: async () => {
        fechar();
        mostrarAviso('Justificativa enviada');
        await recarregar();
      },
    });
    queueMicrotask(() => motivo.focus());
    return formulario;
  });
}

function blocoParaDecidir(lista: readonly JustificativaParaDecidir[], recarregar: () => Promise<void>): HTMLElement {
  const itens = lista.map((j) => {
    const nota = el('input', { type: 'text', maxlength: '300', placeholder: 'Observação (opcional)', 'aria-label': `Observação sobre ${j.pessoa_nome}` });
    const aceitar = el('button', { type: 'button', class: 'btn prim peq' }, 'Aceitar');
    const recusar = el('button', { type: 'button', class: 'btn peq' }, 'Recusar');
    const erro = linhaDeErro();
    const decidir = (aceita: boolean, botao: HTMLButtonElement): void => {
      void executarAcao({ botao, erro, operacao: 'Decidir justificativa', acao: () => decidirJustificativa(j.id, aceita, nota.value.trim()) })
        .then(async (ok) => {
          if (!ok) return;
          mostrarAviso(aceita ? 'Justificativa aceita' : 'Justificativa recusada');
          await recarregar();
        });
    };
    aceitar.addEventListener('click', () => decidir(true, aceitar));
    recusar.addEventListener('click', () => decidir(false, recusar));
    return el('li', { class: 'justificativa' },
      el('div', {}, el('strong', {}, j.pessoa_nome), el('span', { class: 'meta' }, ` · ${j.titulo} · ${dataCurta(j.data)}${j.encerrada ? ' (encerrada)' : ''}`)),
      el('p', {}, j.motivo),
      el('div', { class: 'linha' }, nota, aceitar, recusar),
      erro.elemento);
  });
  return el('section', { class: 'bloco' },
    el('h2', {}, 'Justificativas para decidir'),
    el('ul', { class: 'lista-justificativas' }, ...itens));
}

function blocoFrequencia(linhas: readonly FrequenciaDaPessoa[], meuId: string): HTMLElement {
  if (linhas.length === 0) return el('section', { class: 'bloco' }, el('p', { class: 'vazio' }, 'Nenhuma pessoa para mostrar.'));
  const corpo = ordenarPorFrequencia(linhas).map((linha) => {
    const sou = linha.pessoa_id === meuId;
    return el('tr', { class: sou ? 'eu' : undefined },
      el('td', {}, linha.nome, sou ? el('span', { class: 'meta' }, ' (você)') : null),
      el('td', {}, linha.setor),
      el('td', { class: 'num' }, linha.convocacoes),
      el('td', { class: 'num' }, linha.presencas),
      el('td', { class: 'num' }, linha.justificadas),
      el('td', { class: linha.faltas > 0 ? 'num alerta' : 'num' }, linha.faltas),
      el('td', { class: 'num' }, descreverTaxa(taxaDeFrequencia(linha))));
  });
  return el('section', { class: 'bloco' },
    el('h2', {}, 'Frequência'),
    el('p', { class: 'dica' }, introducaoDaFrequencia(linhas, meuId)),
    el('div', { class: 'tab-wrap' },
      el('table', { class: 'tabela' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Pessoa'), el('th', {}, 'Setor'),
          el('th', { class: 'num' }, 'Convocações'), el('th', { class: 'num' }, 'Presenças'),
          el('th', { class: 'num' }, 'Justificadas'), el('th', { class: 'num' }, 'Faltas'), el('th', { class: 'num' }, 'Frequência'))),
        el('tbody', {}, ...corpo))));
}

// Detalhe da pessoa selecionada: resumo, linha do tempo de lançamentos (com filtros e "desconsiderar") e ajuste.
import type { ContextoDaSessao } from '../../app/sessao';
import { dataCompleta, dataEHora } from '../../lib/datas';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import { tituloDoPapel } from '../../lib/perfil';
import { plural } from '../../lib/texto';
import type { LancamentoVisivel, PessoaComPontuacao } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { el, substituir } from '../../ui/dom';
import { executarAcao, linhaDeErro } from '../../ui/formulario';
import { blocoDeAjuste } from './ajuste';
import { carregarLancamentos, desconsiderarLancamento, type DadosDaPontuacao } from './dados';
import {
  comSinal, contarDesconsiderados, descreverLancamento, descreverPosicao, descreverProjetosAtivos, filtrarLancamentos,
  FILTROS_DE_LANCAMENTOS, NOME_DO_TIPO_DE_LANCAMENTO, posicaoNoRanking, validarMotivoDaDesconsideracao, type FiltroDeLancamentos,
} from './regras';

export interface ContextoDoDetalhe {
  dados: DadosDaPontuacao;
  sessao: ContextoDaSessao;
  /** Recarrega a tela toda (saldos incluídos) depois de uma alteração. */
  recarregar: () => Promise<void>;
}

/** Desenha o detalhe de `pessoa` dentro de `destino`; a linha do tempo chega em seguida, do banco. */
export function mostrarDetalhe(destino: HTMLElement, pessoa: PessoaComPontuacao, contexto: ContextoDoDetalhe): void {
  const { dados, sessao } = contexto;
  const linhaDoTempo = el('div', { class: 'linha-do-tempo' }, el('p', { class: 'meta' }, 'Carregando lançamentos…'));
  const posicao = descreverPosicao(posicaoNoRanking(dados.ranking, pessoa.id));

  const resumo = el('div', { class: 'resumo-membro' },
    el('p', { class: 'eyebrow' }, 'Pessoa selecionada'),
    el('h2', {}, pessoa.nome),
    el('dl', { class: 'dl' },
      ...linha('Pontos atuais', el('span', { class: 'grande' }, pessoa.pontos)),
      ...linha('Posição no ranking', posicao),
      ...linha('Cargo', `${tituloDoPapel(pessoa.papel)} · ${pessoa.setor}`),
      ...(pessoa.curso ? linha('Curso', pessoa.curso) : []),
      ...linha('Entregas positivas', String(pessoa.entregas)),
      ...linha('Faltas', pessoa.justificadas
        ? `${pessoa.faltas} (+${plural(pessoa.justificadas, 'justificada', 'justificadas')})`
        : String(pessoa.faltas)),
      ...linha('Projetos ativos', descreverProjetosAtivos(pessoa.projetos_ativos, pessoa.projetos_ocultos))));

  substituir(destino,
    el('section', { class: 'detalhe', 'aria-label': `Detalhes de ${pessoa.nome}` },
      resumo,
      el('div', { class: 'coluna-tempo' },
        el('p', { class: 'eyebrow' }, 'Histórico'),
        el('h2', {}, 'Linha do tempo completa'),
        linhaDoTempo,
        el('p', { class: 'dica' }, `Saldo = ${dados.config.pontos_iniciais} pontos iniciais + lançamentos válidos.`)),
      blocoDeAjuste(pessoa, sessao, contexto.recarregar)));

  carregarLancamentos(pessoa.id)
    .then((lancamentos) => {
      if (linhaDoTempo.isConnected) desenharLinhaDoTempo(linhaDoTempo, lancamentos, contexto);
    })
    .catch((falha: unknown) => {
      registrarErro('Carregar lançamentos', falha);
      if (linhaDoTempo.isConnected) substituir(linhaDoTempo, el('p', { class: 'mensagem-form erro' }, mensagemParaUsuario(falha)));
    });
}

function linha(rotulo: string, valor: string | HTMLElement): HTMLElement[] {
  return [el('dt', {}, rotulo), el('dd', {}, valor)];
}

function desenharLinhaDoTempo(destino: HTMLElement, lancamentos: readonly LancamentoVisivel[], contexto: ContextoDoDetalhe): void {
  let filtro: FiltroDeLancamentos = 'tudo';
  let mostrarDesconsiderados = false;
  const total = contarDesconsiderados(lancamentos);
  const lista = el('div', {});

  const pilulas = FILTROS_DE_LANCAMENTOS.map((opcao) => {
    const botao = el('button', { type: 'button', class: 'pilula' }, opcao.nome);
    botao.addEventListener('click', () => {
      filtro = opcao.id;
      atualizar();
    });
    return { opcao, botao };
  });
  const caixa = el('input', { type: 'checkbox', id: 'ver-desconsiderados' });
  caixa.addEventListener('change', () => {
    mostrarDesconsiderados = caixa.checked;
    atualizar();
  });

  const atualizar = (): void => {
    for (const { opcao, botao } of pilulas) botao.setAttribute('aria-pressed', String(opcao.id === filtro));
    const itens = filtrarLancamentos(lancamentos, filtro, mostrarDesconsiderados);
    substituir(lista, itens.length
      ? el('ol', { class: 'tempo' }, ...itens.map((l) => itemDoLancamento(l, contexto)))
      : el('p', { class: 'vazio' }, 'Nenhum lançamento neste filtro.'));
  };

  substituir(destino,
    el('div', { class: 'pilulas', role: 'group', 'aria-label': 'Filtrar lançamentos' }, ...pilulas.map(({ botao }) => botao)),
    total
      ? el('label', { class: 'check', for: caixa.id }, caixa, ` Mostrar ${plural(total, 'desconsiderado', 'desconsiderados')}`)
      : null,
    lista);
  atualizar();
}

function itemDoLancamento(l: LancamentoVisivel, contexto: ContextoDoDetalhe): HTMLElement {
  const { nomeDe } = contexto.dados;
  const classes = ['lanc', l.desconsiderado_em ? 'desc' : l.valor < 0 ? 'neg' : ''].filter(Boolean).join(' ');
  const item = el('li', { class: classes },
    el('div', { class: 'lanc-cab' },
      el('strong', {}, NOME_DO_TIPO_DE_LANCAMENTO[l.tipo]),
      el('span', { class: `pts ${l.valor > 0 ? 'pos' : l.valor < 0 ? 'neg' : ''}`.trim() }, `${comSinal(l.valor)} pts`)),
    el('p', {}, descreverLancamento(l)),
    el('span', { class: 'meta' }, `${dataCompleta(l.data)} · lançado por ${l.criado_por ? nomeDe(l.criado_por) : 'o sistema'}`));

  if (l.desconsiderado_em) {
    item.append(el('span', { class: 'meta' },
      `Desconsiderado por ${l.desconsiderado_por ? nomeDe(l.desconsiderado_por) : 'o sistema'} em ${dataEHora(l.desconsiderado_em)}: ${l.motivo_desconsideracao ?? ''}`));
  } else if (l.pode_desconsiderar) {
    item.append(areaDeDesconsiderar(l, contexto));
  }
  return item;
}

function areaDeDesconsiderar(l: LancamentoVisivel, contexto: ContextoDoDetalhe): HTMLElement {
  const motivo = el('input', { type: 'text', id: `mot-${l.id}`, placeholder: 'Motivo (ex.: duplicidade)' });
  const botao = el('button', { type: 'button', class: 'btn peq' }, 'Desconsiderar');
  const erro = linhaDeErro();
  botao.addEventListener('click', () => {
    const problema = validarMotivoDaDesconsideracao(motivo.value);
    if (problema) {
      erro.mostrar(problema);
      return;
    }
    void executarAcao({
      botao, erro, operacao: 'Desconsiderar lançamento',
      acao: () => desconsiderarLancamento(l.id, motivo.value.trim()),
    }).then(async (deuCerto) => {
      if (!deuCerto) return;
      mostrarAviso('Lançamento desconsiderado');
      await contexto.recarregar();
    });
  });
  return el('div', { class: 'desconsiderar' },
    el('label', { for: motivo.id, class: 'sr' }, 'Motivo para tirar da conta'),
    el('div', { class: 'linha' }, motivo, botao),
    erro.elemento);
}

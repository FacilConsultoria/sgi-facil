// Regras: o que cada perfil pode fazer, quem responde por cada área, os valores de pontuação (editáveis por
// quem tem permissão), como funciona a exceção de acesso e, para a Presidência, a simulação de visibilidade.
// Nada aqui calcula permissão: o quadro é texto de apoio e o banco confere cada gravação e cada leitura.
import type { ContextoDaSessao } from '../../app/sessao';
import { plural } from '../../lib/texto';
import { tituloDoPapel } from '../../lib/perfil';
import type { LinhaDaSimulacao, RegrasDePontuacao } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { el, substituir } from '../../ui/dom';
import { campo, ligarEnvio, linhaDeErro } from '../../ui/formulario';
import { montarRecarregavel } from '../../ui/recarregavel';
import { carregarRegras, salvarRegras, type DadosDasRegras } from './dados';
import {
  CAMPOS_DE_PONTOS, descreverQuantidade, introducaoDaSimulacao, LIMITE_DOS_VALORES, passosDaExcecao, perfisDeAcesso,
  ROTULOS_DO_QUADRO, situacaoDasAreas, validarRegrasDePontos, valoresParaOsCampos, type ChaveDePontos, type PerfilDeAcesso,
} from './regras';

export function paginaRegras(destino: HTMLElement, contexto: ContextoDaSessao): void {
  const corpo = el('div', {});
  substituir(destino,
    el('section', { class: 'cab' }, el('div', {},
      el('h1', {}, 'Regras'),
      el('p', { class: 'sub' }, 'O que cada cargo enxerga e pode fazer, e como a pontuação é calculada.'))),
    corpo);

  montarRecarregavel<DadosDasRegras>(corpo, {
    carregar: carregarRegras,
    operacao: 'Carregar regras',
    textoDeCarregando: 'Carregando regras…',
    desenhar: (dados, recarregar) => [
      secaoDoQuadro(),
      secaoDasAreas(dados),
      secaoDaPontuacao(dados.regras, contexto.perfil.pode_editar_regras, recarregar),
      secaoDaExcecao(),
      ...(dados.simulacao.length > 0 ? [secaoDaSimulacao(dados.simulacao)] : []),
    ],
  });
}

function secao(titulo: string, ...conteudo: (HTMLElement | null)[]): HTMLElement {
  return el('section', { class: 'bloco regras-secao' }, el('h2', {}, titulo), ...conteudo);
}

function secaoDoQuadro(): HTMLElement {
  const cartao = (perfil: PerfilDeAcesso): HTMLElement =>
    el('article', { class: 'cartao-regra' },
      el('h3', {}, perfil.perfil),
      el('dl', {}, ...(Object.keys(ROTULOS_DO_QUADRO) as (keyof typeof ROTULOS_DO_QUADRO)[]).flatMap((chave) => [
        el('dt', {}, ROTULOS_DO_QUADRO[chave]),
        el('dd', {}, perfil[chave]),
      ])));
  return secao('Quem pode o quê',
    el('p', { class: 'dica' }, 'A hierarquia vale em todo o sistema e é conferida pelo banco de dados. Esconder um botão nunca substitui essa conferência.'),
    el('div', { class: 'cartoes-regra' }, ...perfisDeAcesso().map(cartao)));
}

function secaoDasAreas(dados: DadosDasRegras): HTMLElement {
  const nomes = new Map(dados.pessoas.map((pessoa) => [pessoa.id, pessoa.nome]));
  const linhas = situacaoDasAreas(dados.areas, (id) => nomes.get(id));
  return secao('Áreas e responsáveis',
    el('p', { class: 'dica' }, 'Com a área sem titular, quem estiver na cobertura responde por ela.'),
    el('div', { class: 'tab-wrap' },
      el('table', { class: 'tabela' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Área'), el('th', {}, 'Responsável'))),
        el('tbody', {}, ...linhas.map((linha) =>
          el('tr', {}, el('td', {}, linha.area), el('td', { class: linha.vaga ? 'meta' : undefined }, linha.responsavel)))))));
}

function secaoDaPontuacao(regras: RegrasDePontuacao, podeEditar: boolean, recarregar: () => Promise<void>): HTMLElement {
  const entradas = new Map<ChaveDePontos, HTMLInputElement>();
  const valores = valoresParaOsCampos(regras);
  const campos = CAMPOS_DE_PONTOS.map(({ chave, rotulo }) => {
    const entrada = el('input', {
      type: 'number', id: `regra-${chave}`, value: valores[chave], step: '1',
      min: String(-LIMITE_DOS_VALORES), max: String(LIMITE_DOS_VALORES), disabled: !podeEditar,
    });
    entradas.set(chave, entrada);
    return campo(rotulo, entrada);
  });
  const publico = el('input', { type: 'checkbox', id: 'regra-ranking-publico', checked: regras.ranking_publico, disabled: !podeEditar });
  const erro = linhaDeErro();
  const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Salvar regras');

  const formulario = el('form', { class: 'form regras-form', novalidate: true },
    el('div', { class: 'regras-campos' }, ...campos),
    el('label', { class: 'check', for: publico.id }, publico, ' Ranking público: todos veem o ranking de todas as pessoas'),
    erro.elemento,
    podeEditar ? botao : null);

  const digitados = (): Record<ChaveDePontos, string> => ({
    pontos_iniciais: entradas.get('pontos_iniciais')?.value ?? '',
    entrega_no_prazo: entradas.get('entrega_no_prazo')?.value ?? '',
    entrega_atrasada: entradas.get('entrega_atrasada')?.value ?? '',
    falta: entradas.get('falta')?.value ?? '',
    falta_justificada: entradas.get('falta_justificada')?.value ?? '',
  });

  if (podeEditar) {
    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Salvar regras de pontuação',
      validar: () => validarRegrasDePontos(digitados()),
      acao: () => {
        const texto = digitados();
        return salvarRegras({
          pontos_iniciais: Number(texto.pontos_iniciais),
          entrega_no_prazo: Number(texto.entrega_no_prazo),
          entrega_atrasada: Number(texto.entrega_atrasada),
          falta: Number(texto.falta),
          falta_justificada: Number(texto.falta_justificada),
          ranking_publico: publico.checked,
        });
      },
      depois: async () => {
        mostrarAviso('Regras salvas');
        await recarregar();
      },
    });
  }

  return secao('Regras de pontuação',
    el('p', { class: 'dica' }, podeEditar
      ? 'Valem para os próximos lançamentos. O que já foi lançado não muda. Cada alteração fica no histórico.'
      : 'Só a Presidência e a Diretoria Administrativa (Gente e Gestão) alteram estes valores.'),
    formulario);
}

function secaoDaExcecao(): HTMLElement {
  return secao('Como funciona a exceção de acesso',
    el('p', { class: 'dica' }, 'Quem precisa ver algo fora do seu alcance pede acesso. Não existe liberação informal.'),
    el('ul', { class: 'passos-da-excecao' },
      ...passosDaExcecao().map((passo) => el('li', {}, el('b', {}, passo.destaque), ` ${passo.texto}`))));
}

function secaoDaSimulacao(linhas: readonly LinhaDaSimulacao[]): HTMLElement {
  return secao('Simulação de visibilidade',
    el('p', { class: 'dica' }, introducaoDaSimulacao(linhas), ` ${plural(linhas.length, 'pessoa ativa', 'pessoas ativas')}.`),
    el('div', { class: 'tab-wrap' },
      el('table', { class: 'tabela' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Pessoa'), el('th', {}, 'Cargo'),
          el('th', { class: 'num' }, 'Demandas'), el('th', { class: 'num' }, 'Por exceção'), el('th', { class: 'num' }, 'Pontuações'))),
        el('tbody', {}, ...linhas.map((linha) =>
          el('tr', {},
            el('td', {}, linha.nome, el('br', {}), el('span', { class: 'meta' }, linha.setor)),
            el('td', {}, tituloDoPapel(linha.papel)),
            el('td', { class: 'num' }, `${linha.demandas_visiveis} de ${linha.total_demandas}`),
            el('td', { class: 'num' }, descreverQuantidade(linha.por_excecao)),
            el('td', { class: 'num' }, linha.pontuacoes_visiveis)))))));
}

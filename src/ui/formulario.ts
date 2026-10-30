// Peças de formulário compartilhadas pelos módulos: campo com rótulo, seletor, linha de erro,
// envio com validação e janela modal de cadastro.
import { mensagemParaUsuario, registrarErro } from '../lib/erros';
import { abrirCamada } from './camada';
import { el } from './dom';

export function botaoFechar(fechar: () => void): HTMLButtonElement {
  const botao = el('button', { type: 'button', class: 'fechar', 'aria-label': 'Fechar' }, '×');
  botao.addEventListener('click', fechar);
  return botao;
}

/** Rótulo + controle, no padrão dos formulários do sistema. */
export function campo(rotulo: string, controle: HTMLElement): HTMLElement {
  return el('div', {}, el('label', { for: controle.id }, rotulo), controle);
}

export function seletor<Valor extends string>(
  id: string,
  opcoes: readonly { id: Valor; nome: string }[],
  atual: Valor | '',
): HTMLSelectElement {
  return el('select', { id },
    ...opcoes.map((opcao) => el('option', { value: opcao.id, selected: opcao.id === atual }, opcao.nome)));
}

export interface LinhaDeErro {
  elemento: HTMLParagraphElement;
  mostrar: (texto: string) => void;
  limpar: () => void;
}

/** Linha de erro do formulário, anunciada por leitores de tela. */
export function linhaDeErro(): LinhaDeErro {
  const elemento = el('p', { class: 'mensagem-form erro', role: 'alert' });
  return {
    elemento,
    mostrar: (texto) => { elemento.textContent = texto; },
    limpar: () => { elemento.textContent = ''; },
  };
}

export interface Envio<Resultado> {
  formulario: HTMLFormElement;
  botao: HTMLButtonElement;
  erro: LinhaDeErro;
  /** Nome da operação para o registro de erros. */
  operacao: string;
  /** Checagem local antes de enviar; devolve a mensagem do problema ou null. */
  validar?: () => string | null;
  acao: () => Promise<Resultado>;
  depois: (resultado: Resultado) => void | Promise<void>;
}

/**
 * Liga o envio do formulário: valida, trava o botão, chama o banco e, em erro,
 * mostra a mensagem traduzida no próprio formulário (o detalhe técnico vai para o console).
 */
export function ligarEnvio<Resultado>(envio: Envio<Resultado>): void {
  envio.formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const problema = envio.validar?.() ?? null;
    if (problema) {
      envio.erro.mostrar(problema);
      return;
    }
    envio.erro.limpar();
    envio.botao.disabled = true;
    envio.acao()
      .then(envio.depois)
      .catch((falha: unknown) => {
        registrarErro(envio.operacao, falha);
        envio.erro.mostrar(mensagemParaUsuario(falha));
      })
      .finally(() => {
        envio.botao.disabled = false;
      });
  });
}

export interface EscolhaDePessoas {
  elemento: HTMLFieldSetElement;
  marcadas: () => string[];
  /** Avisa a cada marcação ou desmarcação (inclusive dos botões "marcar todas" e "limpar"). */
  aoMudar: (acao: () => void) => void;
}

/** Lista de caixas de seleção com "Marcar todas" e "Limpar", para escolher pessoas uma a uma. */
export function escolhaDePessoas(prefixo: string, legenda: string, pessoas: readonly { id: string; nome: string }[]): EscolhaDePessoas {
  const caixas = pessoas.map((pessoa) => ({
    pessoa,
    caixa: el('input', { type: 'checkbox', id: `${prefixo}-${pessoa.id}`, value: pessoa.id }),
  }));
  const avisos: (() => void)[] = [];
  const avisar = (): void => avisos.forEach((acao) => acao());
  const definirTodas = (valor: boolean): void => {
    for (const { caixa } of caixas) caixa.checked = valor;
    avisar();
  };
  const marcarTodas = el('button', { type: 'button', class: 'btn peq' }, 'Marcar todas');
  const limpar = el('button', { type: 'button', class: 'btn peq' }, 'Limpar');
  marcarTodas.addEventListener('click', () => definirTodas(true));
  limpar.addEventListener('click', () => definirTodas(false));
  for (const { caixa } of caixas) caixa.addEventListener('change', avisar);

  const lista = el('div', { class: 'picker' },
    ...caixas.map(({ pessoa, caixa }) => el('label', { for: caixa.id }, caixa, ` ${pessoa.nome}`)));
  if (caixas.length === 0) lista.append(el('p', { class: 'dica' }, 'Ninguém disponível no seu escopo.'));
  return {
    elemento: el('fieldset', {}, el('legend', {}, legenda), el('div', { class: 'linha acima-lista' }, marcarTodas, limpar), lista),
    marcadas: () => caixas.filter(({ caixa }) => caixa.checked).map(({ caixa }) => caixa.value),
    aoMudar: (acao) => { avisos.push(acao); },
  };
}

/**
 * Executa uma ação avulsa (fora de um envio de formulário): trava o botão, mostra a mensagem
 * traduzida em caso de erro e devolve se deu certo. O detalhe técnico vai para o console.
 */
export async function executarAcao(opcoes: {
  botao?: HTMLButtonElement;
  erro: LinhaDeErro;
  operacao: string;
  acao: () => Promise<void>;
}): Promise<boolean> {
  opcoes.erro.limpar();
  if (opcoes.botao) opcoes.botao.disabled = true;
  try {
    await opcoes.acao();
    return true;
  } catch (falha: unknown) {
    registrarErro(opcoes.operacao, falha);
    opcoes.erro.mostrar(mensagemParaUsuario(falha));
    return false;
  } finally {
    if (opcoes.botao) opcoes.botao.disabled = false;
  }
}

/** Janela modal de cadastro: cabeçalho com título, o formulário montado por quem chama e o rodapé dele. */
export function abrirJanela(
  pai: HTMLElement,
  idDoTitulo: string,
  titulo: string,
  montarFormulario: (fechar: () => void) => HTMLFormElement,
): void {
  abrirCamada(pai, {
    tipo: 'modal',
    idDoTitulo,
    montar: (fechar) => {
      const formulario = montarFormulario(fechar);
      formulario.prepend(el('div', { class: 'painel-cab' }, el('h2', { id: idDoTitulo }, titulo), botaoFechar(fechar)));
      return [formulario];
    },
  });
}

/** Rodapé da janela: Cancelar à esquerda do botão principal. */
export function rodapeDaJanela(fechar: () => void, botao: HTMLButtonElement): HTMLElement {
  const cancelar = el('button', { type: 'button', class: 'btn' }, 'Cancelar');
  cancelar.addEventListener('click', fechar);
  return el('div', { class: 'modal-pe' }, cancelar, botao);
}

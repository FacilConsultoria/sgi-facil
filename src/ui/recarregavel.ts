// Conteúdo que carrega dados, se desenha e se redesenha: mostra "Carregando…", a mensagem de erro com
// "Tentar de novo" e descarta respostas que chegam depois de a pessoa ter saído da tela.
import { mensagemParaUsuario, registrarErro } from '../lib/erros';
import { el, substituir } from './dom';

export interface Recarregavel<Dados> {
  carregar: () => Promise<Dados>;
  /** Nome da operação para o registro de erros. */
  operacao: string;
  textoDeCarregando: string;
  desenhar: (dados: Dados, recarregar: () => Promise<void>) => HTMLElement[];
}

/** Monta o conteúdo dentro de `destino` e devolve a função que carrega e desenha de novo. */
export function montarRecarregavel<Dados>(destino: HTMLElement, opcoes: Recarregavel<Dados>): () => Promise<void> {
  // o conteúdo é redesenhado a cada recarga; janelas ficam em `destino`, fora dele
  const conteudo = el('div', {});
  substituir(destino, conteudo);

  const recarregar = async (): Promise<void> => {
    try {
      const dados = await opcoes.carregar();
      // a pessoa pode ter trocado de aba enquanto os dados chegavam
      if (destino.isConnected) substituir(conteudo, ...opcoes.desenhar(dados, recarregar));
    } catch (erro: unknown) {
      registrarErro(opcoes.operacao, erro);
      if (!destino.isConnected) return;
      const tentar = el('button', { type: 'button', class: 'btn' }, 'Tentar de novo');
      tentar.addEventListener('click', () => void recarregar());
      substituir(conteudo, el('section', { class: 'bloco' }, el('p', {}, mensagemParaUsuario(erro)), el('div', { class: 'linha' }, tentar)));
    }
  };

  substituir(conteudo, el('p', { class: 'meta' }, opcoes.textoDeCarregando));
  void recarregar();
  return recarregar;
}

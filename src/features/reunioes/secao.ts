// Seção do painel que busca os próprios dados e se redesenha sozinha. Assim, salvar a ata
// não apaga o que a pessoa está digitando na transcrição, e cada parte mostra o próprio erro.
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import { el, substituir, type Filho } from '../../ui/dom';

export interface Secao {
  elemento: HTMLElement;
  atualizar: () => Promise<void>;
}

export interface OpcoesDeSecao<Dados> {
  /** Nome da operação para o registro de erros. */
  operacao: string;
  carregar: () => Promise<Dados>;
  /** Recebe os dados e a função que recarrega esta seção (para chamar depois de gravar). */
  montar: (dados: Dados, atualizar: () => Promise<void>) => Filho[];
  classe?: string;
}

export function secaoQueCarrega<Dados>(opcoes: OpcoesDeSecao<Dados>): Secao {
  const elemento = el('section', { class: opcoes.classe }, el('p', { class: 'dica' }, 'Carregando…'));
  const atualizar = async (): Promise<void> => {
    try {
      const dados = await opcoes.carregar();
      substituir(elemento, ...opcoes.montar(dados, atualizar));
    } catch (erro: unknown) {
      registrarErro(opcoes.operacao, erro);
      const tentar = el('button', { type: 'button', class: 'btn peq' }, 'Tentar de novo');
      tentar.addEventListener('click', () => void atualizar());
      substituir(elemento, el('p', { class: 'dica' }, `Não foi possível carregar. ${mensagemParaUsuario(erro)}`), tentar);
    }
  };
  void atualizar();
  return { elemento, atualizar };
}

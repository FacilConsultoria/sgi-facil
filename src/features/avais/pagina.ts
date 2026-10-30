// Avais: pedidos que dependem da Presidente ou da Vice-Presidência. Quem pediu acompanha o
// andamento; a Presidente e a Vice aprovam ou negam (o indicador pode_decidir vem do banco).
import { dataEHora } from '../../lib/datas';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import { plural } from '../../lib/texto';
import type { AvalVisivel } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { el, substituir } from '../../ui/dom';
import { executarAcao, linhaDeErro } from '../../ui/formulario';
import { carregarAvais, decidirAval, type DadosDosAvais } from './dados';
import { descreverAcaoDoAval, NOME_DO_STATUS_DE_AVAL, NOME_DO_TIPO_DE_AVAL, separarAvais } from './regras';

/** Monta o conteúdo de Avais dentro de `destino` (a página Autorizações cuida do título e das abas). */
export function montarAvais(destino: HTMLElement): void {
  const conteudo = el('div', {});
  substituir(destino, conteudo);

  const recarregar = async (): Promise<void> => {
    try {
      const dados = await carregarAvais();
      // a pessoa pode ter trocado de aba enquanto os dados chegavam
      if (destino.isConnected) substituir(conteudo, ...desenhar(dados, recarregar));
    } catch (erro: unknown) {
      registrarErro('Carregar avais', erro);
      if (!destino.isConnected) return;
      const tentar = el('button', { type: 'button', class: 'btn' }, 'Tentar de novo');
      tentar.addEventListener('click', () => void recarregar());
      substituir(conteudo, el('section', { class: 'bloco' }, el('p', {}, mensagemParaUsuario(erro)), el('div', { class: 'linha' }, tentar)));
    }
  };

  substituir(conteudo, el('p', { class: 'meta' }, 'Carregando avais…'));
  void recarregar();
}

function desenhar(dados: DadosDosAvais, recarregar: () => Promise<void>): HTMLElement[] {
  const { pendentes, decididos } = separarAvais(dados.avais);
  const lista = (avais: readonly AvalVisivel[], vazio: string): HTMLElement =>
    avais.length
      ? el('div', { class: 'lista' }, ...avais.map((aval) => cartaoDoAval(aval, dados.nomeDe, recarregar)))
      : el('p', { class: 'vazio' }, vazio);
  return [
    el('p', { class: 'dica' }, 'Pedidos que dependem da Presidente ou da Vice-Presidência. Ao aprovar, o sistema executa a ação; ao negar, nada muda.'),
    el('section', { class: 'secao' },
      el('h2', {}, `Aguardando decisão · ${plural(pendentes.length, 'pedido', 'pedidos')}`),
      lista(pendentes, 'Nenhum pedido aguardando decisão.')),
    el('section', { class: 'secao' }, el('h2', {}, 'Decididos'), lista(decididos, 'Nenhum aval decidido ainda.')),
  ];
}

function cartaoDoAval(aval: AvalVisivel, nomeDe: (id: string) => string, recarregar: () => Promise<void>): HTMLElement {
  const selo = el('span', { class: `chip aval-${aval.status}` }, NOME_DO_STATUS_DE_AVAL[aval.status]);
  const cartao = el('article', { class: 'aval' },
    el('div', { class: 'linha selos' }, el('span', { class: 'chip' }, NOME_DO_TIPO_DE_AVAL[aval.tipo]), selo),
    el('p', { class: 'aval-resumo' }, aval.resumo),
    el('p', { class: 'meta' }, `Pedido por ${nomeDe(aval.solicitante)} em ${dataEHora(aval.criado_em)}`),
    el('p', { class: 'meta' }, `Ao aprovar: ${descreverAcaoDoAval(aval)}.`));

  if (aval.decidido_por && aval.decidido_em) {
    cartao.append(el('p', { class: 'meta' },
      `${aval.status === 'aprovado' ? 'Aprovado' : 'Negado'} por ${nomeDe(aval.decidido_por)} em ${dataEHora(aval.decidido_em)}${aval.nota ? `: ${aval.nota}` : ''}`));
  }
  if (!aval.pode_decidir) return cartao;

  const nota = el('textarea', { id: `nota-${aval.id}`, class: 'curto', placeholder: 'Observação (opcional)' });
  const aprovar = el('button', { type: 'button', class: 'btn prim' }, 'Aprovar');
  const negar = el('button', { type: 'button', class: 'btn perigo' }, 'Negar');
  const erro = linhaDeErro();
  const decidir = (aprovado: boolean, botao: HTMLButtonElement): void => {
    void executarAcao({
      botao, erro, operacao: aprovado ? 'Aprovar aval' : 'Negar aval',
      acao: () => decidirAval(aval.id, aprovado, nota.value.trim()),
    }).then(async (deuCerto) => {
      if (!deuCerto) return;
      mostrarAviso(aprovado ? 'Aval aprovado' : 'Aval negado');
      await recarregar();
    });
  };
  aprovar.addEventListener('click', () => decidir(true, aprovar));
  negar.addEventListener('click', () => decidir(false, negar));
  cartao.append(
    el('div', { class: 'form' },
      el('label', { for: nota.id, class: 'sr' }, 'Observação'), nota,
      erro.elemento,
      el('div', { class: 'linha' }, aprovar, negar)));
  return cartao;
}

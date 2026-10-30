// Aba Pontuações: as pessoas cuja pontuação quem consulta pode ver e, ao escolher uma, o detalhe dela.
import type { ContextoDaSessao } from '../../app/sessao';
import { montarRecarregavel } from '../../ui/recarregavel';
import { el, substituir } from '../../ui/dom';
import { carregarPontuacao, type DadosDaPontuacao } from './dados';
import { mostrarDetalhe } from './detalhe';
import { listarPessoas, pessoaInicial } from './regras';

// quem estava selecionada vale até a pessoa sair do sistema
let selecionada: string | null = null;

/** Com poucas pessoas a busca só atrapalha. */
const PESSOAS_PARA_MOSTRAR_BUSCA = 9;

export function montarPontuacoes(destino: HTMLElement, sessao: ContextoDaSessao): void {
  montarRecarregavel<DadosDaPontuacao>(destino, {
    carregar: carregarPontuacao,
    operacao: 'Carregar pontuação',
    textoDeCarregando: 'Carregando pontuações…',
    desenhar: (dados, recarregar) => desenhar(dados, sessao, recarregar),
  });
}

function desenhar(dados: DadosDaPontuacao, sessao: ContextoDaSessao, recarregar: () => Promise<void>): HTMLElement[] {
  const { pessoas } = dados;
  if (pessoas.length === 0) return [el('p', { class: 'vazio' }, 'Nenhuma pontuação para mostrar.')];

  selecionada = pessoaInicial(pessoas, sessao.perfil.id, selecionada);
  let busca = '';
  const grade = el('div', { class: 'membros' });
  const detalhe = el('div', { id: 'detalhe-membro' });

  const desenharDetalhe = (): void => {
    const pessoa = pessoas.find((p) => p.id === selecionada);
    if (pessoa) mostrarDetalhe(detalhe, pessoa, { dados, sessao, recarregar });
    else substituir(detalhe);
  };

  const desenharGrade = (): void => {
    const itens = listarPessoas(pessoas, busca);
    substituir(grade, ...(itens.length
      ? itens.map((pessoa) => {
        const botao = el('button', { type: 'button', class: 'membro', 'aria-pressed': String(pessoa.id === selecionada) },
          el('strong', {}, pessoa.nome),
          el('span', { class: 'pts' }, `${pessoa.pontos} pts`),
          el('span', { class: 'meta' }, pessoa.setor));
        botao.addEventListener('click', () => {
          selecionada = pessoa.id;
          desenharGrade();
          desenharDetalhe();
        });
        return botao;
      })
      : [el('p', { class: 'vazio' }, 'Ninguém com esse nome.')]));
  };

  const campoDeBusca = el('input', { type: 'search', id: 'busca-pessoa', placeholder: 'Buscar pessoa', autocomplete: 'off' });
  campoDeBusca.addEventListener('input', () => {
    busca = campoDeBusca.value;
    desenharGrade();
  });

  desenharGrade();
  desenharDetalhe();
  const blocoDeBusca = el('div', { class: 'busca' }, el('label', { for: campoDeBusca.id, class: 'sr' }, 'Buscar pessoa'), campoDeBusca);
  return [
    el('p', { class: 'dica' }, pessoas.length > 1
      ? 'Selecione uma pessoa para ver o histórico completo e, se tiver permissão, ajustar a pontuação.'
      : 'Seu saldo de pontos e o histórico que o compõe.'),
    ...(pessoas.length >= PESSOAS_PARA_MOSTRAR_BUSCA ? [blocoDeBusca] : []),
    grade,
    detalhe,
  ];
}

// Aba Cadastro: lista de pessoas (com e-mail e situação) para quem cadastra, com cadastrar e alterar.
// Quem pode alterar cada pessoa vem de pode_editar, calculado pelo banco.
import type { ContextoDaSessao } from '../../app/sessao';
import { plural } from '../../lib/texto';
import { el, substituir } from '../../ui/dom';
import { abrirDadosDaPessoa } from '../dadospessoais/visualizacao';
import type { DadosDaEstrutura } from './dados';
import { abrirFormularioDePessoa } from './formulario-pessoa';
import { descreverCargoDaPessoa, filtrarEquipe } from './regras';

export interface ContextoDoCadastro {
  /** Onde as janelas são montadas (fora do conteúdo, que é redesenhado). */
  pagina: HTMLElement;
  dados: DadosDaEstrutura;
  sessao: ContextoDaSessao;
  recarregar: () => Promise<void>;
}

export function desenharCadastro(contexto: ContextoDoCadastro): HTMLElement[] {
  const { dados } = contexto;
  let busca = '';
  let mostrarDesativadas = false;
  const desativadas = dados.pessoas.filter((p) => !p.ativo).length;
  const lista = el('div', {});

  const campoDeBusca = el('input', { type: 'search', id: 'busca-equipe', placeholder: 'Buscar por nome ou e-mail', autocomplete: 'off' });
  campoDeBusca.addEventListener('input', () => { busca = campoDeBusca.value; desenharLista(); });
  const caixa = el('input', { type: 'checkbox', id: 'ver-desativadas' });
  caixa.addEventListener('change', () => { mostrarDesativadas = caixa.checked; desenharLista(); });

  const desenharLista = (): void => {
    const pessoas = filtrarEquipe(dados.pessoas, busca, mostrarDesativadas);
    if (pessoas.length === 0) {
      substituir(lista, el('p', { class: 'vazio' }, 'Ninguém encontrado.'));
      return;
    }
    const linhas = pessoas.map((pessoa) => {
      const editar = el('button', { type: 'button', class: 'btn peq' }, 'Editar');
      editar.addEventListener('click', () => abrirFormularioDePessoa(contexto, pessoa));
      // dados pessoais: só a Presidente (o banco devolve linha só a ela e à própria pessoa)
      const dadosPessoais = contexto.sessao.perfil.eh_presidente ? el('button', { type: 'button', class: 'btn peq' }, 'Dados pessoais') : null;
      dadosPessoais?.addEventListener('click', () => void abrirDadosDaPessoa(contexto.pagina, pessoa));
      return el('tr', { class: pessoa.ativo ? undefined : 'desativada' },
        el('td', {}, pessoa.nome, el('br', {}), el('span', { class: 'meta' }, pessoa.email ?? '')),
        el('td', {}, descreverCargoDaPessoa(pessoa, dados.areas, dados.nucleos)),
        el('td', {}, pessoa.curso ?? '–'),
        el('td', {}, el('span', { class: pessoa.ativo ? 'chip ok' : 'chip' }, pessoa.ativo ? 'Ativa' : 'Desativada')),
        el('td', { class: 'acoes-da-linha' }, dadosPessoais, pessoa.pode_editar ? editar : null));
    });
    substituir(lista,
      el('div', { class: 'tab-wrap' },
        el('table', { class: 'tabela' },
          el('thead', {}, el('tr', {}, ...['Pessoa', 'Cargo', 'Curso', 'Situação', ''].map((titulo) => el('th', {}, titulo)))),
          el('tbody', {}, ...linhas))));
  };

  const cadastrar = el('button', { type: 'button', class: 'btn prim' }, 'Cadastrar pessoa');
  cadastrar.addEventListener('click', () => abrirFormularioDePessoa(contexto));
  desenharLista();
  return [
    el('div', { class: 'linha acoes-da-aba' },
      el('p', { class: 'dica' }, 'Quem entra no SGI com um e-mail que não está aqui não vê nada. Cadastre a pessoa e peça que ela use "Primeiro acesso".'),
      cadastrar),
    el('div', { class: 'busca' }, el('label', { for: campoDeBusca.id, class: 'sr' }, 'Buscar pessoa'), campoDeBusca),
    ...(desativadas
      ? [el('label', { class: 'check filtro-desativadas', for: caixa.id }, caixa, ` Mostrar ${plural(desativadas, 'pessoa desativada', 'pessoas desativadas')}`)]
      : []),
    lista,
  ];
}

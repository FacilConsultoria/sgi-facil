// Aba "Dados do time": as pessoas cujos dados pessoais quem consulta pode ler (a Presidente e a Assessoria veem todas;
// cada diretoria vê as gerências, assessorias e membros das áreas que conduz). Quem entra na lista vem do banco
// (pode_ver_dados); aqui só se mostra, filtra e abre a janela de leitura.
import type { ContextoDaSessao } from '../../app/sessao';
import { plural } from '../../lib/texto';
import { el, substituir } from '../../ui/dom';
import { abrirDadosDaPessoa } from '../dadospessoais/visualizacao';
import type { DadosDaEstrutura } from './dados';
import { descreverCargoDaPessoa, pessoasDoTime } from './regras';

export interface ContextoDosDadosDoTime {
  pagina: HTMLElement;
  dados: DadosDaEstrutura;
  sessao: ContextoDaSessao;
}

export function desenharDadosDoTime(contexto: ContextoDosDadosDoTime): HTMLElement[] {
  const { dados, sessao } = contexto;
  const time = pessoasDoTime(dados.pessoas, sessao.perfil.id);
  const pendentes = time.filter((p) => p.dados_preenchidos === false).length;
  let busca = '';
  let soPendentes = false;
  const lista = el('div', {});

  const campoDeBusca = el('input', { type: 'search', id: 'busca-time', placeholder: 'Buscar por nome', autocomplete: 'off' });
  campoDeBusca.addEventListener('input', () => { busca = campoDeBusca.value; desenharLista(); });
  const caixa = el('input', { type: 'checkbox', id: 'so-pendentes' });
  caixa.addEventListener('change', () => { soPendentes = caixa.checked; desenharLista(); });

  const desenharLista = (): void => {
    const termo = busca.trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    const visiveis = time.filter((p) => (!soPendentes || p.dados_preenchidos === false)
      && (!termo || p.nome.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().includes(termo)));
    if (visiveis.length === 0) {
      substituir(lista, el('p', { class: 'vazio' }, time.length ? 'Ninguém encontrado.' : 'Ninguém no seu time por enquanto.'));
      return;
    }
    substituir(lista,
      el('div', { class: 'tab-wrap' },
        el('table', { class: 'tabela' },
          el('thead', {}, el('tr', {}, ...['Pessoa', 'Cargo', 'Dados pessoais', ''].map((titulo) => el('th', {}, titulo)))),
          el('tbody', {}, ...visiveis.map((pessoa) => {
            const ver = el('button', { type: 'button', class: 'btn peq' }, 'Ver dados');
            ver.addEventListener('click', () => void abrirDadosDaPessoa(contexto.pagina, pessoa));
            return el('tr', {},
              el('td', {}, pessoa.nome),
              el('td', {}, descreverCargoDaPessoa(pessoa, dados.areas, dados.nucleos)),
              el('td', {}, pessoa.dados_preenchidos
                ? el('span', { class: 'chip ok' }, 'Preenchidos')
                : el('span', { class: 'chip dados-pendentes' }, 'Pendentes')),
              el('td', { class: 'acoes-da-linha' }, ver));
          })))));
  };
  desenharLista();

  return [
    el('p', { class: 'dica' },
      sessao.perfil.pode_ver_dados_pessoais
        ? 'Dados pessoais de toda a equipe (nome completo, RGA, CPF, nascimento e gênero). Só leitura: cada pessoa altera os próprios em "Meus dados".'
        : 'Dados pessoais das pessoas das áreas que você conduz (nome completo, RGA, CPF, nascimento e gênero). Só leitura: cada pessoa altera os próprios em "Meus dados".'),
    el('div', { class: 'linha acoes-da-aba' },
      el('div', { class: 'busca' }, el('label', { for: campoDeBusca.id, class: 'sr' }, 'Buscar pessoa'), campoDeBusca),
      pendentes
        ? el('label', { class: 'check', for: caixa.id }, caixa, ` Só quem não preencheu (${plural(pendentes, 'pessoa', 'pessoas')})`)
        : null),
    lista,
  ];
}

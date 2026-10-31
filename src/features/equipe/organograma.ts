// Aba Organograma: Presidência no topo e, abaixo, cada diretoria com os seus núcleos e pessoas.
// O diretório de pessoas é aberto a quem tem cadastro (decisão do banco, supabase/01); só a Presidência vê
// o botão de definir titular e cobertura (o indicador vem de areas_da_estrutura).
import type { ContextoDaSessao } from '../../app/sessao';
import { el } from '../../ui/dom';
import type { PessoaDaEquipe } from '../../types/database';
import type { DadosDaEstrutura } from './dados';
import { abrirDefinirLideranca } from './lideranca';
import { descreverResponsavel, iniciais, montarOrganograma, type AreaNoOrganograma, type NucleoNoOrganograma } from './regras';

export interface ContextoDoOrganograma {
  /** Onde as janelas são montadas (fora do conteúdo, que é redesenhado). */
  pagina: HTMLElement;
  dados: DadosDaEstrutura;
  sessao: ContextoDaSessao;
  recarregar: () => Promise<void>;
}

export function desenharOrganograma(contexto: ContextoDoOrganograma): HTMLElement[] {
  const { areas, nucleos, pessoas } = contexto.dados;
  const organograma = montarOrganograma(areas, nucleos, pessoas);
  const meuId = contexto.sessao.perfil.id;

  const avatar = (nome: string): HTMLElement => el('span', { class: 'av', 'aria-hidden': 'true' }, iniciais(nome));
  const voce = (pessoa: PessoaDaEquipe): string => (pessoa.id === meuId ? ' (você)' : '');

  const no = (titulo: string, pessoa: PessoaDaEquipe | null, vago: string, classe = ''): HTMLElement =>
    pessoa
      ? el('div', { class: `no ${classe}`.trim() },
        avatar(pessoa.nome),
        el('div', { class: 'no-txt' }, el('b', {}, titulo), el('span', {}, `${pessoa.nome}${voce(pessoa)}`)))
      : el('div', { class: `no vago ${classe}`.trim() },
        el('div', { class: 'no-txt' }, el('b', {}, titulo), el('span', {}, vago)));

  const nucleo = (item: NucleoNoOrganograma, dono: AreaNoOrganograma): HTMLElement => {
    const gente = [...item.lideres, ...item.membros];
    return el('section', { class: 'grupo-org' },
      el('h3', {}, item.nucleo.nome, item.nucleo.vaga ? el('span', { class: 'chip vaga' }, 'Vaga') : null),
      gente.length
        ? el('ul', { class: 'gente' }, ...gente.map((pessoa) =>
          el('li', {}, avatar(pessoa.nome),
            el('span', {}, `${pessoa.nome}${voce(pessoa)}`, item.lideres.includes(pessoa) ? el('small', {}, ' · liderança') : null))))
        : el('p', { class: 'meta' }, `Conduzido por ${dono.titular?.nome ?? dono.cobertura?.nome ?? 'a Presidência'}`));
  };

  const ramo = (item: AreaNoOrganograma): HTMLElement => {
    const definir = el('button', { type: 'button', class: 'btn peq' }, 'Definir liderança');
    definir.addEventListener('click', () => abrirDefinirLideranca(contexto, item));
    return el('div', { class: 'ramo' },
      no(item.area.titulo, item.titular, descreverResponsavel(item)),
      item.area.pode_definir_lideranca ? el('div', { class: 'acao-do-ramo' }, definir) : null,
      ...item.nucleos.map((n) => nucleo(n, item)));
  };

  const { presidencia, diretorias } = organograma;
  return [
    el('div', { class: 'legenda' }, el('span', {}, el('span', { class: 'chip vaga' }, 'Vaga'), ' Liderança em aberto')),
    el('div', { class: 'orgchart' },
      presidencia
        ? el('div', { class: 'topo-org' },
          no(presidencia.area.titulo, presidencia.titular, descreverResponsavel(presidencia), 'raiz'),
          el('div', { class: 'staff' },
            ...presidencia.nucleos.map((n) => nucleo(n, presidencia)),
            presidencia.area.pode_definir_lideranca
              ? (() => {
                const definir = el('button', { type: 'button', class: 'btn peq' }, 'Definir liderança');
                definir.addEventListener('click', () => abrirDefinirLideranca(contexto, presidencia));
                return definir;
              })()
              : null))
        : null,
      el('div', { class: 'ramos' }, ...diretorias.map(ramo))),
  ];
}

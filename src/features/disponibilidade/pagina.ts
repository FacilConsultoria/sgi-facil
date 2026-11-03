// Disponibilidade: cada pessoa marca uma vez, numa grade semanal, os horários em que costuma poder participar de
// reuniões e atividades ("Minha disponibilidade"). Quem enxerga outras pessoas pela hierarquia vê também a aba
// "Equipe", que mostra quantas das pessoas escolhidas estão livres em cada horário e sugere os melhores horários
// para uma reunião. A grade é referência para escolher horários; não é agenda de compromissos.
import type { ContextoDaSessao } from '../../app/sessao';
import { dataEHora } from '../../lib/datas';
import { mostrarAviso } from '../../ui/aviso';
import { montarPaginaComAbas, type Aba } from '../../ui/abas';
import { el, substituir } from '../../ui/dom';
import { escolhaDePessoas, ligarEnvio, linhaDeErro } from '../../ui/formulario';
import { montarRecarregavel } from '../../ui/recarregavel';
import { carregarDisponibilidade, salvarMinhaDisponibilidade, type DadosDaDisponibilidade } from './dados';
import { montarGradeEditavel, montarMapaDeCalor } from './grade';
import {
  contarDisponiveis, descreverJanela, DURACOES_EM_HORAS, melhoresJanelas, resumirSemana, semGrade,
} from './regras';

type IdDaAba = 'minha' | 'equipe';

// a aba escolhida vale até a pessoa sair do sistema
let abaAtual: IdDaAba = 'minha';

export function paginaDisponibilidade(destino: HTMLElement, contexto: ContextoDaSessao): void {
  montarRecarregavel<DadosDaDisponibilidade>(destino, {
    carregar: carregarDisponibilidade,
    operacao: 'Carregar disponibilidade',
    textoDeCarregando: 'Carregando disponibilidade…',
    desenhar: (dados, recarregar) => {
      const pagina = el('div', {});
      const abas: Aba<IdDaAba>[] = [
        { id: 'minha', titulo: 'Minha disponibilidade', montar: (painel) => montarMinha(painel, dados, contexto.perfil.id, recarregar) },
      ];
      // a aba da equipe só existe para quem enxerga alguém além de si (a RLS decide quem aparece)
      if (dados.pessoas.some((pessoa) => pessoa.id !== contexto.perfil.id)) {
        abas.push({ id: 'equipe', titulo: 'Equipe', montar: (painel) => montarEquipe(painel, dados) });
      }
      montarPaginaComAbas<IdDaAba>(pagina, {
        titulo: 'Disponibilidade',
        subtitulo: 'Os horários da semana em que você costuma poder participar de reuniões e atividades.',
        abas,
        inicial: abas.some((aba) => aba.id === abaAtual) ? abaAtual : 'minha',
        aoEscolher: (id) => { abaAtual = id; },
      });
      return [pagina];
    },
  });
}

function montarMinha(painel: HTMLElement, dados: DadosDaDisponibilidade, meuId: string, recarregar: () => Promise<void>): void {
  const minhaGrade = dados.grades.get(meuId) ?? new Set<number>();
  const eu = dados.pessoas.find((pessoa) => pessoa.id === meuId);
  const resumo = el('p', { class: 'resumo-semana', 'aria-live': 'polite' }, resumirSemana(minhaGrade));
  const grade = montarGradeEditavel(minhaGrade, (horarios) => { resumo.textContent = resumirSemana(horarios); });

  const salvar = el('button', { type: 'submit', class: 'btn prim' }, 'Salvar disponibilidade');
  const limpar = el('button', { type: 'button', class: 'btn' }, 'Limpar tudo');
  limpar.addEventListener('click', () => {
    grade.definir(new Set());
    resumo.textContent = resumirSemana(new Set());
  });
  const erro = linhaDeErro();

  const formulario = el('form', { class: 'form', novalidate: true },
    el('p', { class: 'dica' },
      'Marque uma vez e atualize quando mudar. Clique em um horário, em um dia (Seg, Ter…) ou em uma hora para marcar ou desmarcar vários de uma vez. Quem enxerga o seu perfil na hierarquia (Presidência, diretoria da sua área e gerência do seu núcleo) vê esta grade.'),
    grade.elemento,
    resumo,
    el('p', { class: 'meta' }, eu?.preenchida && eu.atualizado_em ? `Última atualização: ${dataEHora(eu.atualizado_em)}.` : 'Você ainda não salvou a sua disponibilidade.'),
    erro.elemento,
    el('div', { class: 'linha' }, salvar, limpar));

  ligarEnvio({
    formulario, botao: salvar, erro,
    operacao: 'Salvar disponibilidade',
    acao: () => salvarMinhaDisponibilidade(grade.selecionados()),
    depois: async () => {
      mostrarAviso('Disponibilidade salva');
      await recarregar();
    },
  });
  substituir(painel, formulario);
}

function montarEquipe(painel: HTMLElement, dados: DadosDaDisponibilidade): void {
  const comGrade = dados.pessoas.filter((pessoa) => pessoa.preenchida).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const escolha = escolhaDePessoas('disp', 'Pessoas', comGrade.map((pessoa) => ({ id: pessoa.id, nome: pessoa.nome })));
  // começa com todas marcadas
  [...escolha.elemento.querySelectorAll('button')].find((botao) => botao.textContent === 'Marcar todas')?.click();

  const duracao = el('select', { id: 'disp-duracao' },
    ...DURACOES_EM_HORAS.map((horas) => el('option', { value: String(horas), selected: horas === 2 }, `${horas} ${horas === 1 ? 'hora' : 'horas'}`)));
  const resultado = el('div', { class: 'resultado-disp', 'aria-live': 'polite' });
  const pendentes = semGrade(dados.pessoas);

  const atualizar = (): void => {
    const ids = escolha.marcadas();
    if (ids.length === 0) {
      substituir(resultado, el('p', { class: 'vazio' }, 'Escolha pelo menos uma pessoa.'));
      return;
    }
    const janelas = melhoresJanelas(dados.grades, ids, Number(duracao.value));
    substituir(resultado,
      el('h2', {}, 'Melhores horários'),
      janelas.length
        ? el('ul', { class: 'melhores' }, ...janelas.map((janela) => el('li', {}, descreverJanela(janela))))
        : el('p', { class: 'vazio' }, 'Nenhum horário em comum: as pessoas escolhidas não têm uma folga de mesma duração.'),
      el('h2', {}, 'Quem está livre em cada horário'),
      el('p', { class: 'dica' }, `Cada número é quantas das ${ids.length} pessoas escolhidas estão livres; quanto mais escuro, mais gente.`),
      montarMapaDeCalor(contarDisponiveis(dados.grades, ids), ids.length));
  };
  escolha.aoMudar(atualizar);
  duracao.addEventListener('change', atualizar);

  substituir(painel,
    el('p', { class: 'dica' }, 'Veja a disponibilidade das pessoas que você acompanha e encontre um horário que sirva para a maioria.'),
    el('div', { class: 'disp-equipe' },
      el('div', { class: 'disp-controles' },
        escolha.elemento,
        el('div', {}, el('label', { for: duracao.id }, 'Duração da reunião'), duracao),
        pendentes.length ? el('p', { class: 'meta' }, `Ainda sem disponibilidade salva: ${pendentes.join(', ')}.`) : null),
      resultado));
  atualizar();
}

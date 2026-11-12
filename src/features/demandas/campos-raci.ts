// Passos 2 e 3 do cadastro de demanda: quem aprova (A) e o alcance, com quem é informado (I).
// As opções vêm das visões do banco (aprovadores_possiveis e pessoas_informaveis); o banco confere tudo de novo ao gravar.
import type { AlcanceDaEntrega } from '../../types/database';
import { el, substituir } from '../../ui/dom';
import type { DadosDoQuadro, RaciEscolhida } from './dados';
import {
  ALCANCES, aprovadoresDoProjeto, aprovadorInicial, ehAR, informadosAutomaticos, informaveisDisponiveis, PERGUNTA_DO_ALCANCE,
  PERGUNTA_DO_APROVADOR,
} from './raci';

export interface RaciDoFormulario {
  aprovador: string | null;
  alcance: AlcanceDaEntrega | null;
  informados: string[];
}

export interface CamposDeRaci {
  aprovador: HTMLElement;
  alcance: HTMLElement;
  /** Redesenha as opções quando o projeto, a restrição ou os executores mudam (as escolhas válidas são mantidas). */
  atualizar: () => void;
  ler: () => RaciDoFormulario;
}

export interface OpcoesDosCamposDeRaci {
  prefixo: string;
  dados: DadosDoQuadro;
  projetoId: () => string;
  restrita: () => boolean;
  executores: () => string[];
  /** Na edição: a RACI atual da demanda. */
  inicial?: { aprovador: string | null; alcance: AlcanceDaEntrega; informados: readonly string[] };
}

export function camposDeRaci(opcoes: OpcoesDosCamposDeRaci): CamposDeRaci {
  const { prefixo, dados, inicial } = opcoes;
  let aprovadorEscolhido: string | null = inicial?.aprovador ?? null;
  let alcance: AlcanceDaEntrega = inicial?.alcance ?? 'parte';
  const informadosEscolhidos = new Set<string>(inicial?.informados ?? []);

  // ---------- passo 2: aprovador ----------
  const seletorDoAprovador = el('select', { id: `${prefixo}-aprovador` });
  const seloAR = el('span', { class: 'chip ar', title: 'Quem executa também aprova: concluir encerra a entrega direto.' }, 'A/R');
  const avisoAR = el('p', { class: 'dica' }, 'Uma só pessoa executa e aprova: ao concluir, a entrega é encerrada direto, sem etapa de aprovação.');
  const passoDoAprovador = el('fieldset', { class: 'passo-raci' },
    el('legend', {}, '2. Aprovador (A)'),
    el('label', { for: seletorDoAprovador.id, class: 'pergunta' }, PERGUNTA_DO_APROVADOR),
    el('div', { class: 'linha' }, seletorDoAprovador, seloAR),
    el('p', { class: 'dica' }, 'Já vem com a diretoria da área. Troque só em casos de exceção.'),
    avisoAR);

  // ---------- passo 3: alcance e informados ----------
  const radios = ALCANCES.map((opcao) => el('input', {
    type: 'radio', name: `${prefixo}-alcance`, id: `${prefixo}-alcance-${opcao.id}`, value: opcao.id, checked: opcao.id === alcance,
  }));
  const cartoes = ALCANCES.map((opcao, i) => el('label', { class: 'cartao-alcance', for: `${prefixo}-alcance-${opcao.id}` },
    radios[i] ?? null, el('b', {}, opcao.nome)));
  const detalheDoAlcance = el('div', { class: 'detalhe-alcance', 'aria-live': 'polite' });
  const passoDoAlcance = el('fieldset', { class: 'passo-raci' },
    el('legend', {}, '3. Alcance e informados (I)'),
    el('p', { class: 'pergunta' }, PERGUNTA_DO_ALCANCE),
    el('div', { class: 'cartoes-alcance' }, ...cartoes),
    detalheDoAlcance);

  const desenharAprovador = (): void => {
    const lista = aprovadoresDoProjeto(dados.aprovadores, opcoes.projetoId(), opcoes.restrita());
    // aprovador atual fora da lista (saiu da liderança, por exemplo): continua como opção, como os executores fora do escopo
    const atualForaDaLista = inicial?.aprovador && !lista.some((a) => a.pessoa_id === inicial.aprovador) ? inicial.aprovador : null;
    aprovadorEscolhido = atualForaDaLista && aprovadorEscolhido === atualForaDaLista
      ? atualForaDaLista
      : aprovadorInicial(lista, aprovadorEscolhido);
    substituir(seletorDoAprovador,
      ...lista.map((a) => el('option', { value: a.pessoa_id, selected: a.pessoa_id === aprovadorEscolhido },
        a.sugerido ? `${a.nome} (diretoria da área)` : a.nome)),
      ...(atualForaDaLista
        ? [el('option', { value: atualForaDaLista, selected: atualForaDaLista === aprovadorEscolhido }, `${dados.nomeDe(atualForaDaLista)} (atual)`)]
        : []));
    if (!seletorDoAprovador.options.length) seletorDoAprovador.append(el('option', { value: '' }, 'Ninguém pode aprovar neste projeto'));
    const ar = ehAR(opcoes.executores(), aprovadorEscolhido);
    seloAR.hidden = !ar;
    avisoAR.hidden = !ar;
  };

  const desenharAlcance = (): void => {
    const escolhido = ALCANCES.find((a) => a.id === alcance) ?? ALCANCES[0];
    if (!escolhido) return;
    cartoes.forEach((cartao, i) => cartao.classList.toggle('escolhido', ALCANCES[i]?.id === alcance));
    const partes: HTMLElement[] = [
      el('p', { class: 'exemplos' }, el('b', {}, 'Exemplos: '), escolhido.exemplos),
      el('p', { class: 'dica' }, escolhido.efeito),
    ];
    if (alcance === 'geral') {
      const executores = opcoes.executores();
      const automaticos = informadosAutomaticos(dados.informaveis, executores, aprovadorEscolhido);
      const disponiveis = informaveisDisponiveis(dados.informaveis, executores, aprovadorEscolhido, opcoes.restrita());
      // quem passou a executar ou aprovar sai dos informados (trava de papéis duplicados)
      for (const id of [...informadosEscolhidos]) if (!disponiveis.some((p) => p.id === id)) informadosEscolhidos.delete(id);
      if (automaticos.length) {
        partes.push(el('p', { class: 'informado-fixo' },
          el('span', { class: 'chip i' }, 'I'), ` ${automaticos.map((p) => p.nome).join(', ')} (Presidência) recebe o aviso de conclusão.`));
      }
      if (disponiveis.length) {
        const caixas = disponiveis.map((p) => {
          const caixa = el('input', { type: 'checkbox', id: `${prefixo}-inf-${p.id}`, value: p.id, checked: informadosEscolhidos.has(p.id) });
          caixa.addEventListener('change', () => {
            if (caixa.checked) informadosEscolhidos.add(p.id);
            else informadosEscolhidos.delete(p.id);
          });
          return el('label', { for: caixa.id }, caixa, ` ${p.nome}`);
        });
        partes.push(el('fieldset', { class: 'informados' },
          el('legend', {}, 'Avisar também (opcional)'),
          el('div', { class: 'picker' }, ...caixas)));
      }
    }
    substituir(detalheDoAlcance, ...partes);
  };

  seletorDoAprovador.addEventListener('change', () => {
    aprovadorEscolhido = seletorDoAprovador.value || null;
    desenharAprovador();
    desenharAlcance();
  });
  for (const radio of radios) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      alcance = radio.value as AlcanceDaEntrega;
      desenharAlcance();
    });
  }

  const atualizar = (): void => {
    desenharAprovador();
    desenharAlcance();
  };
  atualizar();

  return {
    aprovador: passoDoAprovador,
    alcance: passoDoAlcance,
    atualizar,
    ler: () => ({
      aprovador: aprovadorEscolhido,
      alcance,
      informados: alcance === 'geral' ? [...informadosEscolhidos] : [],
    }),
  };
}

/** Converte o que foi lido do formulário no formato das funções de gravação (depois de validado). */
export function raciParaGravar(raci: RaciDoFormulario): RaciEscolhida {
  return { aprovador: raci.aprovador ?? '', alcance: raci.alcance ?? 'parte', informados: raci.informados };
}

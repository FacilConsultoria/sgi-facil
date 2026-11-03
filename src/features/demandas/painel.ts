// Painel lateral de uma demanda: detalhes, por que a pessoa vê, o que ela pode fazer
// (editar, só mudar o status ou só consultar, conforme os indicadores do banco) e histórico.
import { dataCompleta, dataEHora } from '../../lib/datas';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import type { DemandaVisivel, Prioridade, StatusDemanda } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { abrirCamada } from '../../ui/camada';
import { el, substituir } from '../../ui/dom';
import { botaoFechar, campo, ligarEnvio, linhaDeErro, seletor } from '../../ui/formulario';
import { iconeDoPrazo, seletorDeExecutores, seloDeAcesso, seloDePrioridade, seloDeRestricao, seloDeStatus } from './componentes';
import type { ContextoDeDemandas } from './contexto';
import { carregarHistorico, editarDemanda, mudarStatus } from './dados';
import {
  agruparExecutores, descreverPrazoCompleto, estaAtrasada, explicarAcesso, PRIORIDADES, STATUS, statusPermitidos, validarDemanda,
} from './regras';

export function abrirPainelDaDemanda(contexto: ContextoDeDemandas, demanda: DemandaVisivel): void {
  const { dados, hoje } = contexto;
  const atrasada = estaAtrasada(demanda, hoje);
  const idDoTitulo = 'painel-demanda-titulo';

  abrirCamada(contexto.pagina, {
    tipo: 'painel',
    idDoTitulo,
    montar: (fechar) => [
      el('div', { class: 'painel-cab' },
        el('span', { class: 'mono' }, `${demanda.codigo} · ${demanda.nucleo_nome}`),
        botaoFechar(fechar)),
      el('div', { class: 'painel-corpo' },
        el('div', {},
          el('h2', { id: idDoTitulo }, demanda.titulo),
          el('div', { class: 'linha selos' },
            seloDeStatus(demanda.status),
            seloDePrioridade(demanda.prioridade),
            seloDeAcesso(demanda),
            demanda.restrita ? seloDeRestricao() : null)),
        el('p', { class: 'porque' },
          el('strong', {}, 'Por que você vê esta demanda: '),
          explicarAcesso(demanda, contexto.tituloDaArea)),
        el('dl', { class: 'dl' },
          ...item('Projeto', [demanda.projeto_nome, demanda.projeto_cliente].filter(Boolean).join(' · ')),
          ...item('Área', contexto.tituloDaArea(demanda.area_id)),
          ...item('Prazo', el('span', { class: 'prazo-com-icone' }, iconeDoPrazo(demanda, hoje), descreverPrazoCompleto(demanda, hoje)), atrasada ? 'prazo atrasada' : undefined),
          ...(demanda.concluida_em ? item('Concluída em', dataCompleta(demanda.concluida_em)) : []),
          ...item('Executores', demanda.executores.map(dados.nomeDe).join(', ')),
          ...item('Criada por', dados.nomeDe(demanda.criado_por)),
          ...(demanda.pode_gerir ? [] : item('Descrição', demanda.descricao || 'Sem descrição', demanda.descricao ? undefined : 'meta'))),
        areaDeAcao(contexto, demanda, fechar),
        secaoDeHistorico(demanda, dados.nomeDe)),
    ],
  });
}

function item(rotulo: string, valor: string | HTMLElement, classe?: string): HTMLElement[] {
  return [el('dt', {}, rotulo), el('dd', { class: classe }, valor)];
}

function areaDeAcao(contexto: ContextoDeDemandas, demanda: DemandaVisivel, fechar: () => void): HTMLElement {
  if (demanda.pode_gerir) return formularioDeEdicao(contexto, demanda, fechar);
  if (demanda.pode_mudar_status) return formularioDeStatus(contexto, demanda, fechar);
  let texto = 'Somente consulta. Para alterar esta demanda, peça à liderança do núcleo para incluir você como executor.';
  if (demanda.motivo_acesso === 'excecao') texto = 'Somente consulta: a liberação por exceção não permite alterar a demanda.';
  else if (demanda.motivo_acesso === 'executor' && demanda.status === 'concluida') {
    texto = 'Demanda concluída e validada. Só a liderança do núcleo, a diretoria ou a Presidência podem reabri-la.';
  }
  return el('p', { class: 'somente-leitura' }, texto);
}

/** Depois de gravar: fecha o painel, confirma e redesenha o quadro com os dados novos. */
function concluir(contexto: ContextoDeDemandas, fechar: () => void, aviso: string): () => Promise<void> {
  return async () => {
    fechar();
    mostrarAviso(aviso);
    await contexto.recarregar();
  };
}

function formularioDeEdicao(contexto: ContextoDeDemandas, demanda: DemandaVisivel, fechar: () => void): HTMLFormElement {
  const { dados, perfil } = contexto;
  const projeto = dados.projetos.find((p) => p.id === demanda.projeto_id);
  const titulo = el('input', { type: 'text', id: 'ed-titulo', maxlength: '120', value: demanda.titulo });
  const descricao = el('textarea', { id: 'ed-descricao' }, demanda.descricao);
  const status = seletor<StatusDemanda>('ed-status', STATUS, demanda.status);
  const prioridade = seletor<Prioridade>('ed-prioridade', PRIORIDADES, demanda.prioridade);
  const prazo = el('input', { type: 'date', id: 'ed-prazo', value: demanda.prazo });
  const executores = seletorDeExecutores('ed',
    agruparExecutores(dados.atribuiveis, demanda.nucleo_id, demanda.executores, dados.nomeDe), demanda.executores);
  // restringir a demanda só faz sentido quando o projeto inteiro não é restrito
  const podeRestringir = perfil.eh_presidencia && projeto !== undefined && !projeto.restrito;
  const restrita = el('input', { type: 'checkbox', id: 'ed-restrita', checked: demanda.restrita });
  const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Salvar alterações');
  const erro = linhaDeErro();

  const formulario = el('form', { class: 'form', novalidate: true },
    el('h3', {}, 'Editar demanda'),
    campo('Título', titulo),
    campo('Descrição', descricao),
    el('div', { class: 'dois' }, campo('Status', status), campo('Prioridade', prioridade)),
    campo('Prazo', prazo),
    executores.elemento,
    podeRestringir
      ? el('label', { class: 'check', for: 'ed-restrita' }, restrita, ' Restringir à Presidência (oculta das diretorias e núcleos)')
      : null,
    el('p', { class: 'dica' }, 'Marcar como concluída lança os pontos de entrega para cada executor (mais pontos se estiver no prazo). Reabrir desconsidera esses pontos.'),
    erro.elemento,
    el('div', { class: 'linha' }, botao));

  ligarEnvio({
    formulario, botao, erro,
    operacao: 'Editar demanda',
    validar: () => validarDemanda({ titulo: titulo.value, prazo: prazo.value, executores: executores.marcados() }),
    acao: () => editarDemanda(demanda.id, {
      titulo: titulo.value.trim(),
      descricao: descricao.value.trim(),
      status: status.value as StatusDemanda,
      prioridade: prioridade.value as Prioridade,
      prazo: prazo.value,
      executores: executores.marcados(),
      restrita: podeRestringir ? restrita.checked : null,
    }),
    depois: concluir(contexto, fechar, 'Alterações salvas'),
  });
  return formulario;
}

function formularioDeStatus(contexto: ContextoDeDemandas, demanda: DemandaVisivel, fechar: () => void): HTMLFormElement {
  const permitidos = statusPermitidos(demanda);
  const status = seletor<StatusDemanda>('st-status', STATUS.filter((s) => permitidos.includes(s.id)), demanda.status);
  const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Salvar status');
  const erro = linhaDeErro();
  const formulario = el('form', { class: 'form', novalidate: true },
    campo('Atualizar status', status),
    el('p', { class: 'dica' }, 'Ao terminar, mova para “Em revisão”. A liderança valida a conclusão e lança os pontos.'),
    erro.elemento,
    el('div', { class: 'linha' }, botao));
  ligarEnvio({
    formulario, botao, erro,
    operacao: 'Mudar status',
    acao: () => mudarStatus(demanda.id, status.value as StatusDemanda),
    depois: concluir(contexto, fechar, 'Status atualizado'),
  });
  return formulario;
}

function secaoDeHistorico(demanda: DemandaVisivel, nomeDe: (id: string) => string): HTMLElement {
  const corpo = el('div', {}, el('p', { class: 'dica' }, 'Carregando histórico…'));
  carregarHistorico(demanda.id)
    .then((registros) => {
      substituir(corpo, registros.length
        ? el('ul', { class: 'hist' },
          ...registros.map((r) => el('li', {},
            el('time', { datetime: r.em }, dataEHora(r.em)),
            el('span', {}, el('strong', {}, r.ator ? nomeDe(r.ator) : 'Integração'), ` · ${r.acao}: ${r.detalhe}`))))
        : el('p', { class: 'dica' }, 'Sem alterações registradas.'));
    })
    .catch((falha: unknown) => {
      registrarErro('Carregar histórico da demanda', falha);
      substituir(corpo, el('p', { class: 'dica' }, `Não foi possível carregar o histórico. ${mensagemParaUsuario(falha)}`));
    });
  return el('section', { class: 'secao-hist' }, el('h3', {}, 'Histórico'), corpo);
}

// Painel lateral de uma demanda: detalhes, matriz RACI, por que a pessoa vê, o que ela pode fazer
// (passagens da RACI, editar, só mudar o status ou só consultar, conforme os indicadores do banco), conversa e histórico.
import { dataCompleta, dataEHora } from '../../lib/datas';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import type { DemandaVisivel, MensagemDaDemanda, Prioridade, StatusDemanda } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { abrirCamada } from '../../ui/camada';
import { el, substituir } from '../../ui/dom';
import { botaoFechar, campo, ligarEnvio, linhaDeErro, seletor } from '../../ui/formulario';
import { camposDeRaci, raciParaGravar } from './campos-raci';
import { seletorDeExecutores, seloDeAcesso, seloDePapel, seloDePrioridade, seloDeRestricao, seloDeStatus } from './componentes';
import type { ContextoDeDemandas } from './contexto';
import {
  aprovarEntrega, carregarConversa, carregarHistorico, editarDemanda, entregarDemanda, mudarStatus, responderDuvida, sinalizarDuvida,
  solicitarAjuste,
} from './dados';
import {
  descreverComQuem, LIMITE_DO_TEXTO_DA_CONVERSA, NOME_DA_MENSAGEM, NOME_DO_ALCANCE, validarRaci, validarTextoDaConversa,
} from './raci';
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
          ...item('Prazo', descreverPrazoCompleto(demanda, hoje), atrasada ? 'prazo atrasada' : undefined),
          ...(demanda.concluida_em ? item('Concluída em', dataCompleta(demanda.concluida_em)) : []),
          ...item('Criada por', dados.nomeDe(demanda.criado_por)),
          ...(demanda.pode_gerir ? [] : item('Descrição', demanda.descricao || 'Sem descrição', demanda.descricao ? undefined : 'meta'))),
        secaoDaRaci(contexto, demanda),
        acoesDaRaci(contexto, demanda, fechar),
        areaDeAcao(contexto, demanda, fechar),
        secaoDaConversa(demanda),
        secaoDeHistorico(demanda, dados.nomeDe)),
    ],
  });
}

function item(rotulo: string, valor: string | HTMLElement, classe?: string): HTMLElement[] {
  return [el('dt', {}, rotulo), el('dd', { class: classe }, valor)];
}

/** Quem executa, quem aprova, alcance, quem é informado e com quem a demanda está agora. */
function secaoDaRaci(contexto: ContextoDeDemandas, demanda: DemandaVisivel): HTMLElement {
  const { nomeDe } = contexto.dados;
  const pessoas = (ids: readonly string[]): string => (ids.length ? ids.map(nomeDe).join(', ') : 'Ninguém');
  return el('section', { class: 'secao-raci', 'aria-label': 'Matriz RACI' },
    el('h3', {}, 'Matriz RACI'),
    el('p', { class: demanda.com_quem === 'aprovador' ? 'com-quem aprovador' : 'com-quem' }, descreverComQuem(demanda)),
    el('dl', { class: 'dl' },
      ...item('Executa (R)', pessoas(demanda.executores)),
      ...item('Aprova (A)', demanda.aprovador_id
        ? el('span', {}, nomeDe(demanda.aprovador_id), demanda.eh_ar ? ' ' : null, demanda.eh_ar ? seloDePapel('A/R') : null)
        : 'Sem aprovador: a liderança do núcleo valida'),
      ...item('Alcance', NOME_DO_ALCANCE[demanda.alcance]),
      ...(demanda.alcance === 'geral' ? item('Informados (I)', pessoas(demanda.informados)) : [])));
}

/** Depois de gravar: fecha o painel, confirma e redesenha o quadro com os dados novos. */
function concluir(contexto: ContextoDeDemandas, fechar: () => void, aviso: string): () => Promise<void> {
  return async () => {
    fechar();
    mostrarAviso(aviso);
    await contexto.recarregar();
  };
}

/** Uma passagem da RACI: texto (opcional ou obrigatório) e um ou dois botões. */
function formularioDePassagem(opcoes: {
  titulo: string;
  explicacao: string;
  id: string;
  rotuloDoTexto: string;
  textoObrigatorio: string | null;
  botoes: { rotulo: string; principal: boolean; textoObrigatorio?: string | null; acao: (texto: string) => Promise<unknown>; aviso: string }[];
  depois: (aviso: string) => () => Promise<void>;
}): HTMLFormElement {
  const texto = el('textarea', { id: opcoes.id, maxlength: String(LIMITE_DO_TEXTO_DA_CONVERSA), rows: '3' });
  const erro = linhaDeErro();
  const botoes = opcoes.botoes.map((b) => el('button', { type: 'submit', class: b.principal ? 'btn prim' : 'btn' }, b.rotulo));
  const formulario = el('form', { class: 'form passagem', novalidate: true },
    el('h3', {}, opcoes.titulo),
    el('p', { class: 'dica' }, opcoes.explicacao),
    campo(opcoes.rotuloDoTexto, texto),
    erro.elemento,
    el('div', { class: 'linha' }, ...botoes));
  // cada botão envia a sua ação (submitter diz qual foi clicado)
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const indice = botoes.findIndex((b) => b === evento.submitter);
    const escolhido = opcoes.botoes[indice < 0 ? 0 : indice];
    const botao = botoes[indice < 0 ? 0 : indice];
    if (!escolhido || !botao) return;
    const obrigatorio = escolhido.textoObrigatorio === undefined ? opcoes.textoObrigatorio : escolhido.textoObrigatorio;
    const problema = validarTextoDaConversa(texto.value, obrigatorio);
    if (problema) {
      erro.mostrar(problema);
      return;
    }
    erro.limpar();
    for (const b of botoes) b.disabled = true;
    escolhido.acao(texto.value.trim())
      .then(opcoes.depois(escolhido.aviso))
      .catch((falha: unknown) => {
        registrarErro(opcoes.titulo, falha);
        erro.mostrar(mensagemParaUsuario(falha));
      })
      .finally(() => { for (const b of botoes) b.disabled = false; });
  });
  return formulario;
}

/** Botões da etapa atual para quem tem a demanda na caixa (os indicadores vêm do banco). */
function acoesDaRaci(contexto: ContextoDeDemandas, demanda: DemandaVisivel, fechar: () => void): HTMLElement | null {
  const depois = (aviso: string): (() => Promise<void>) => concluir(contexto, fechar, aviso);
  const partes: HTMLElement[] = [];
  if (demanda.pode_responder_duvida) {
    partes.push(formularioDePassagem({
      titulo: 'Responder dúvida',
      explicacao: 'Quem executa pediu ajuda. Responda para a demanda voltar à caixa de quem executa.',
      id: 'raci-resposta', rotuloDoTexto: 'Resposta', textoObrigatorio: 'Escreva a resposta.',
      botoes: [{ rotulo: 'Responder e devolver', principal: true, acao: (t) => responderDuvida(demanda.id, t), aviso: 'Dúvida respondida' }],
      depois,
    }));
  }
  if (demanda.pode_avaliar) {
    partes.push(formularioDePassagem({
      titulo: 'Avaliar entrega',
      explicacao: 'Aprovar conclui a demanda e lança os pontos de entrega. Para pedir ajuste, explique o que falta: a demanda volta para quem executa.',
      id: 'raci-avaliacao', rotuloDoTexto: 'Comentário (obrigatório para pedir ajuste)', textoObrigatorio: null,
      botoes: [
        { rotulo: 'Aprovar entrega', principal: true, acao: (t) => aprovarEntrega(demanda.id, t), aviso: 'Entrega aprovada' },
        {
          rotulo: 'Solicitar ajuste', principal: false, textoObrigatorio: 'Explique o ajuste que precisa ser feito.',
          acao: (t) => solicitarAjuste(demanda.id, t), aviso: 'Ajuste pedido',
        },
      ],
      depois,
    }));
  }
  if (demanda.pode_entregar) {
    partes.push(formularioDePassagem({
      titulo: demanda.eh_ar ? 'Concluir entrega' : 'Enviar para aprovação',
      explicacao: demanda.eh_ar
        ? 'Você executa e aprova (A/R): concluir encerra a entrega direto e lança os pontos.'
        : 'Ao terminar, envie para quem aprova. A demanda sai da sua caixa até a aprovação ou um pedido de ajuste.',
      id: 'raci-entrega', rotuloDoTexto: 'Nota da entrega (opcional)', textoObrigatorio: null,
      botoes: [{
        rotulo: demanda.eh_ar ? 'Concluir entrega' : 'Enviar para aprovação', principal: true,
        acao: (t) => entregarDemanda(demanda.id, t), aviso: demanda.eh_ar ? 'Entrega concluída' : 'Enviada para aprovação',
      }],
      depois,
    }));
  }
  if (demanda.pode_sinalizar_duvida) {
    partes.push(formularioDePassagem({
      titulo: 'Sinalizar dúvida a quem aprova',
      explicacao: 'A demanda vai para o topo da caixa de quem aprova e volta para você com a resposta.',
      id: 'raci-duvida', rotuloDoTexto: 'Dúvida', textoObrigatorio: 'Escreva a dúvida.',
      botoes: [{ rotulo: 'Enviar dúvida', principal: false, acao: (t) => sinalizarDuvida(demanda.id, t), aviso: 'Dúvida enviada' }],
      depois,
    }));
  }
  return partes.length ? el('section', { class: 'acoes-raci' }, ...partes) : null;
}

function areaDeAcao(contexto: ContextoDeDemandas, demanda: DemandaVisivel, fechar: () => void): HTMLElement | null {
  if (demanda.pode_gerir) return formularioDeEdicao(contexto, demanda, fechar);
  const executa = demanda.executores.includes(contexto.perfil.id);
  if (demanda.pode_mudar_status && (demanda.status === 'afazer' || demanda.status === 'andamento') && !demanda.duvida_aberta) {
    return formularioDeStatus(contexto, demanda, fechar);
  }
  if (executa && demanda.com_quem === 'aprovador') {
    return el('p', { class: 'somente-leitura' }, demanda.duvida_aberta
      ? 'Sua dúvida está com quem aprova. Você é avisado no sino quando houver resposta.'
      : 'A entrega está com quem aprova. Você é avisado no sino quando for aprovada ou se houver pedido de ajuste.');
  }
  if (demanda.pode_avaliar || demanda.pode_responder_duvida) return null;
  let texto = 'Somente consulta. Para alterar esta demanda, peça à liderança do núcleo para incluir você como executor.';
  if (demanda.motivo_acesso === 'excecao') texto = 'Somente consulta: a liberação por exceção não permite alterar a demanda.';
  else if (demanda.motivo_acesso === 'informado') texto = 'Somente consulta: você é avisado no sino quando a entrega for concluída.';
  else if (demanda.motivo_acesso === 'aprovador') texto = 'Nada para você fazer agora. A demanda entra na sua caixa quando for enviada para aprovação ou houver dúvida.';
  else if (executa && demanda.status === 'concluida') {
    texto = 'Demanda concluída e validada. Só a liderança do núcleo, a diretoria ou a Presidência podem reabri-la.';
  }
  return el('p', { class: 'somente-leitura' }, texto);
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
  const raci = camposDeRaci({
    prefixo: 'ed',
    dados,
    projetoId: () => demanda.projeto_id,
    restrita: () => (podeRestringir ? restrita.checked : demanda.restrita),
    executores: () => executores.marcados(),
    // a Presidente entra sozinha nos informados; aqui só as escolhas
    inicial: {
      aprovador: demanda.aprovador_id,
      alcance: demanda.alcance,
      informados: demanda.informados.filter((id) => !dados.informaveis.some((p) => p.id === id && p.automatico)),
    },
  });
  executores.elemento.addEventListener('change', raci.atualizar);
  restrita.addEventListener('change', raci.atualizar);
  const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Salvar alterações');
  const erro = linhaDeErro();

  const formulario = el('form', { class: 'form', novalidate: true },
    el('h3', {}, 'Editar demanda'),
    campo('Título', titulo),
    campo('Descrição', descricao),
    el('div', { class: 'dois' }, campo('Status', status), campo('Prioridade', prioridade)),
    campo('Prazo', prazo),
    podeRestringir
      ? el('label', { class: 'check', for: 'ed-restrita' }, restrita, ' Restringir à Presidência (oculta das diretorias e núcleos)')
      : null,
    executores.elemento,
    raci.aprovador,
    raci.alcance,
    el('p', { class: 'dica' }, 'Marcar como concluída lança os pontos de entrega para cada executor (mais pontos se estiver no prazo). Reabrir desconsidera esses pontos.'),
    erro.elemento,
    el('div', { class: 'linha' }, botao));

  ligarEnvio({
    formulario, botao, erro,
    operacao: 'Editar demanda',
    validar: () => validarDemanda({ titulo: titulo.value, prazo: prazo.value, executores: executores.marcados() })
      ?? validarRaci({ executores: executores.marcados(), ...raci.ler() }),
    acao: () => editarDemanda(demanda.id, {
      titulo: titulo.value.trim(),
      descricao: descricao.value.trim(),
      status: status.value as StatusDemanda,
      prioridade: prioridade.value as Prioridade,
      prazo: prazo.value,
      executores: executores.marcados(),
      restrita: podeRestringir ? restrita.checked : null,
      raci: raciParaGravar(raci.ler()),
    }),
    depois: concluir(contexto, fechar, 'Alterações salvas'),
  });
  return formulario;
}

function formularioDeStatus(contexto: ContextoDeDemandas, demanda: DemandaVisivel, fechar: () => void): HTMLFormElement {
  const permitidos = statusPermitidos(demanda);
  const status = seletor<StatusDemanda>('st-status', STATUS.filter((s) => permitidos.includes(s.id)), demanda.status);
  const botao = el('button', { type: 'submit', class: 'btn' }, 'Salvar etapa');
  const erro = linhaDeErro();
  const formulario = el('form', { class: 'form', novalidate: true },
    campo('Etapa', status),
    el('p', { class: 'dica' }, 'Use “Em andamento” quando começar. Para entregar, use o botão acima.'),
    erro.elemento,
    el('div', { class: 'linha' }, botao));
  ligarEnvio({
    formulario, botao, erro,
    operacao: 'Mudar status',
    acao: () => mudarStatus(demanda.id, status.value as StatusDemanda),
    depois: concluir(contexto, fechar, 'Etapa atualizada'),
  });
  return formulario;
}

function secaoDaConversa(demanda: DemandaVisivel): HTMLElement {
  const corpo = el('div', {}, el('p', { class: 'dica' }, 'Carregando conversa…'));
  const secao = el('section', { class: 'secao-conversa' }, el('h3', {}, 'Conversa'), corpo);
  carregarConversa(demanda.id)
    .then((mensagens: MensagemDaDemanda[]) => {
      if (!mensagens.length) {
        secao.hidden = true;
        return;
      }
      substituir(corpo, el('ul', { class: 'conversa' },
        ...mensagens.map((m) => el('li', { class: `msg ${m.tipo}` },
          el('div', { class: 'msg-cab' },
            el('b', {}, NOME_DA_MENSAGEM[m.tipo]),
            el('span', { class: 'meta' }, ` · ${m.autor_nome} · `, el('time', { datetime: m.criado_em }, dataEHora(m.criado_em)))),
          el('p', {}, m.texto)))));
    })
    .catch((falha: unknown) => {
      registrarErro('Carregar conversa da demanda', falha);
      substituir(corpo, el('p', { class: 'dica' }, `Não foi possível carregar a conversa. ${mensagemParaUsuario(falha)}`));
    });
  return secao;
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

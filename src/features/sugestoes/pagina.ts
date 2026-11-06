// Sugestões: melhorias, bugs e ideias para o SGI. Todas as pessoas veem, apoiam e comentam; a Presidência responde
// (indicador pode_responder da visão). Nada de permissão é decidido aqui.
import type { ContextoDaSessao } from '../../app/sessao';
import { dataEHora } from '../../lib/datas';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import type { ComentarioDeSugestao, SituacaoDaSugestao, SugestaoDoPainel, TipoDeSugestao } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { abrirCamada } from '../../ui/camada';
import { el, substituir } from '../../ui/dom';
import { abrirJanela, botaoFechar, campo, ligarEnvio, linhaDeErro, rodapeDaJanela, seletor } from '../../ui/formulario';
import { montarRecarregavel } from '../../ui/recarregavel';
import { apoiarSugestao, carregarComentarios, carregarSugestoes, comentarSugestao, criarSugestao, responderSugestao } from './dados';
import {
  contarPorGrupo, descreverApoios, descreverAutoria, estaEmAberto, FILTRO_INICIAL, filtrarSugestoes, LIMITE_DA_DESCRICAO_DA_SUGESTAO,
  LIMITE_DA_RESPOSTA, LIMITE_DO_COMENTARIO, LIMITE_DO_TITULO_DA_SUGESTAO, nomeDaSituacao, nomeDoTipo, SITUACOES_DE_SUGESTAO,
  TIPOS_DE_SUGESTAO, validarComentario, validarResposta, validarSugestao, type FiltroDeSugestoes, type GrupoDeSugestoes,
} from './regras';

// o filtro sobrevive às recargas depois de apoiar, comentar ou responder
let filtro: FiltroDeSugestoes = { ...FILTRO_INICIAL };

export function paginaSugestoes(destino: HTMLElement, contexto: ContextoDaSessao): void {
  const nova = el('button', { type: 'button', class: 'btn prim' }, 'Nova sugestão');
  const corpo = el('div', {});
  substituir(destino,
    el('section', { class: 'cab' },
      el('div', {},
        el('h1', {}, 'Sugestões'),
        el('p', { class: 'sub' }, 'Melhorias, bugs e ideias para o SGI. Todo mundo vê, apoia e comenta; a Presidência responde.')),
      el('div', { class: 'linha' }, nova)),
    corpo);

  const recarregar = montarRecarregavel<SugestaoDoPainel[]>(corpo, {
    carregar: carregarSugestoes,
    operacao: 'Carregar sugestões',
    textoDeCarregando: 'Carregando sugestões…',
    desenhar: (lista, recarregarDeNovo) => desenharLista(lista, contexto.perfil.id, destino, recarregarDeNovo),
  });
  nova.addEventListener('click', () => abrirNovaSugestao(destino, recarregar));
}

function desenharLista(lista: SugestaoDoPainel[], meuId: string, pai: HTMLElement, recarregar: () => Promise<void>): HTMLElement[] {
  const area = el('div', { class: 'lista-sugestoes' });
  const contagem = contarPorGrupo(lista);
  const rotuloDoGrupo: Record<GrupoDeSugestoes, string> = { em_aberto: 'Em aberto', concluidas: 'Concluídas', todas: 'Todas' };
  const abas = (Object.keys(rotuloDoGrupo) as GrupoDeSugestoes[]).map((grupo) => {
    const botao = el('button', { type: 'button', class: 'aba-sugestoes', 'aria-pressed': String(filtro.grupo === grupo) },
      `${rotuloDoGrupo[grupo]} (${contagem[grupo]})`);
    botao.addEventListener('click', () => {
      filtro = { ...filtro, grupo };
      for (const outro of abas) outro.setAttribute('aria-pressed', String(outro === botao));
      atualizar();
    });
    return botao;
  });
  const tipo = el('select', { id: 'sug-filtro-tipo', 'aria-label': 'Tipo' },
    el('option', { value: '' }, 'Todos os tipos'),
    ...TIPOS_DE_SUGESTAO.map((t) => el('option', { value: t.id, selected: filtro.tipo === t.id }, t.nome)));
  const busca = el('input', { type: 'search', id: 'sug-busca', placeholder: 'Buscar nas sugestões', value: filtro.busca, 'aria-label': 'Buscar nas sugestões' });
  tipo.addEventListener('change', () => { filtro = { ...filtro, tipo: tipo.value as TipoDeSugestao | '' }; atualizar(); });
  busca.addEventListener('input', () => { filtro = { ...filtro, busca: busca.value }; atualizar(); });

  const atualizar = (): void => {
    const visiveis = filtrarSugestoes(lista, filtro);
    substituir(area, ...(visiveis.length
      ? visiveis.map((s) => cartaoDaSugestao(s, meuId, pai, recarregar))
      : [el('p', { class: 'vazio' }, lista.length ? 'Nenhuma sugestão com esses filtros.' : 'Nenhuma sugestão ainda. Use “Nova sugestão” para mandar a primeira.')]));
  };
  atualizar();

  return [
    el('div', { class: 'filtros filtros-sugestoes' },
      el('div', { class: 'abas-sugestoes', role: 'group', 'aria-label': 'Situação' }, ...abas),
      tipo, busca),
    area,
  ];
}

function cartaoDaSugestao(sugestao: SugestaoDoPainel, meuId: string, pai: HTMLElement, recarregar: () => Promise<void>): HTMLElement {
  const minha = sugestao.autor_id === meuId;
  const apoiar = el('button', {
    type: 'button', class: sugestao.apoiei ? 'btn peq apoio ativo' : 'btn peq apoio', 'aria-pressed': String(sugestao.apoiei), disabled: minha,
    title: minha ? 'Sua sugestão: quem sugeriu já conta como apoio.' : undefined,
  }, `${sugestao.apoiei ? 'Apoiando' : 'Apoiar'} · ${descreverApoios(sugestao.apoios)}`);
  apoiar.addEventListener('click', () => {
    apoiar.disabled = true;
    apoiarSugestao(sugestao.id)
      .then(() => recarregar())
      .catch((erro: unknown) => {
        registrarErro('Apoiar sugestão', erro);
        mostrarAviso(mensagemParaUsuario(erro), 'erro');
        apoiar.disabled = false;
      });
  });
  const comentarios = el('button', { type: 'button', class: 'btn peq' },
    sugestao.comentarios === 1 ? '1 comentário' : `${sugestao.comentarios} comentários`);
  comentarios.addEventListener('click', () => abrirComentarios(sugestao, pai, recarregar));
  const responder = sugestao.pode_responder ? el('button', { type: 'button', class: 'btn peq' }, 'Responder') : null;
  responder?.addEventListener('click', () => abrirResposta(sugestao, pai, recarregar));

  return el('article', { class: `bloco sugestao situacao-${sugestao.situacao}` },
    el('div', { class: 'linha sugestao-topo' },
      el('span', { class: `chip tipo-${sugestao.tipo}` }, nomeDoTipo(sugestao.tipo)),
      el('span', { class: `chip situacao ${estaEmAberto(sugestao.situacao) ? 'em-aberto' : 'concluida'}` }, nomeDaSituacao(sugestao.situacao))),
    el('h3', {}, sugestao.titulo),
    el('p', { class: 'meta' }, descreverAutoria(sugestao), minha ? ' · sua sugestão' : ''),
    el('p', { class: 'sugestao-texto' }, sugestao.descricao),
    sugestao.resposta
      ? el('div', { class: 'sugestao-resposta' },
        el('b', {}, `Resposta${sugestao.respondido_por_nome ? ` de ${sugestao.respondido_por_nome}` : ''}`),
        el('p', {}, sugestao.resposta))
      : null,
    el('div', { class: 'linha sugestao-acoes' }, apoiar, comentarios, responder));
}

function abrirNovaSugestao(pai: HTMLElement, recarregar: () => Promise<void>): void {
  abrirJanela(pai, 'nova-sugestao-titulo', 'Nova sugestão', (fechar) => {
    const tipo = seletor<TipoDeSugestao>('sug-tipo', TIPOS_DE_SUGESTAO, 'melhoria');
    const titulo = el('input', { type: 'text', id: 'sug-titulo', maxlength: String(LIMITE_DO_TITULO_DA_SUGESTAO), autocomplete: 'off' });
    const descricao = el('textarea', { id: 'sug-descricao', rows: '6', maxlength: String(LIMITE_DA_DESCRICAO_DA_SUGESTAO) });
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Enviar');
    const erro = linhaDeErro();
    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        campo('Tipo', tipo),
        campo('Título', titulo),
        campo('Descrição', descricao),
        el('p', { class: 'dica' }, 'Para bugs, conte o que você fez, o que esperava e o que aconteceu (em qual tela e, se der, o horário).'),
        erro.elemento),
      rodapeDaJanela(fechar, botao));
    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Enviar sugestão',
      validar: () => validarSugestao({ tipo: tipo.value, titulo: titulo.value, descricao: descricao.value }),
      acao: () => criarSugestao({ tipo: tipo.value as TipoDeSugestao, titulo: titulo.value.trim(), descricao: descricao.value.trim() }),
      depois: async () => {
        fechar();
        mostrarAviso('Sugestão enviada');
        filtro = { ...filtro, grupo: 'em_aberto' };
        await recarregar();
      },
    });
    queueMicrotask(() => titulo.focus());
    return formulario;
  });
}

function abrirResposta(sugestao: SugestaoDoPainel, pai: HTMLElement, recarregar: () => Promise<void>): void {
  abrirJanela(pai, 'responder-sugestao-titulo', 'Responder sugestão', (fechar) => {
    const situacao = seletor<SituacaoDaSugestao>('sug-situacao', SITUACOES_DE_SUGESTAO, sugestao.situacao);
    const resposta = el('textarea', { id: 'sug-resposta', rows: '4', maxlength: String(LIMITE_DA_RESPOSTA) }, sugestao.resposta ?? '');
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Salvar resposta');
    const erro = linhaDeErro();
    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        el('p', {}, el('strong', {}, sugestao.titulo), ` · ${descreverAutoria(sugestao)}`),
        campo('Situação', situacao),
        campo('Resposta (opcional, todos veem)', resposta),
        el('p', { class: 'dica' }, 'Quem sugeriu é avisado no sino.'),
        erro.elemento),
      rodapeDaJanela(fechar, botao));
    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Responder sugestão',
      validar: () => validarResposta(situacao.value, resposta.value),
      acao: () => responderSugestao(sugestao.id, situacao.value as SituacaoDaSugestao, resposta.value.trim() || null),
      depois: async () => {
        fechar();
        mostrarAviso('Resposta salva');
        await recarregar();
      },
    });
    return formulario;
  });
}

function abrirComentarios(sugestao: SugestaoDoPainel, pai: HTMLElement, recarregar: () => Promise<void>): void {
  const idDoTitulo = 'comentarios-sugestao-titulo';
  abrirCamada(pai, {
    tipo: 'painel',
    idDoTitulo,
    montar: (fechar) => {
      const lista = el('div', {}, el('p', { class: 'dica' }, 'Carregando comentários…'));
      const texto = el('textarea', { id: 'sug-comentario', rows: '3', maxlength: String(LIMITE_DO_COMENTARIO) });
      const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Comentar');
      const erro = linhaDeErro();
      const formulario = el('form', { class: 'form', novalidate: true },
        campo('Seu comentário', texto), erro.elemento, el('div', { class: 'linha' }, botao));
      let comentou = false;

      const carregar = (): void => {
        carregarComentarios(sugestao.id)
          .then((comentarios) => substituir(lista, comentarios.length
            ? el('ul', { class: 'comentarios-sugestao' }, ...comentarios.map(itemDeComentario))
            : el('p', { class: 'vazio' }, 'Nenhum comentário ainda.')))
          .catch((falha: unknown) => {
            registrarErro('Carregar comentários da sugestão', falha);
            substituir(lista, el('p', { class: 'dica' }, `Não foi possível carregar os comentários. ${mensagemParaUsuario(falha)}`));
          });
      };
      ligarEnvio({
        formulario, botao, erro,
        operacao: 'Comentar sugestão',
        validar: () => validarComentario(texto.value),
        acao: () => comentarSugestao(sugestao.id, texto.value.trim()),
        depois: () => {
          texto.value = '';
          comentou = true;
          carregar();
        },
      });
      carregar();
      // ao fechar, a lista principal atualiza a contagem de comentários
      const fecharEAtualizar = (): void => {
        fechar();
        if (comentou) void recarregar();
      };
      return [
        el('div', { class: 'painel-cab' }, el('h2', { id: idDoTitulo }, sugestao.titulo), botaoFechar(fecharEAtualizar)),
        el('div', { class: 'painel-corpo' },
          el('p', { class: 'sugestao-texto' }, sugestao.descricao),
          el('p', { class: 'meta' }, descreverAutoria(sugestao)),
          el('section', {}, el('h3', {}, 'Comentários'), lista),
          formulario),
      ];
    },
  });
}

function itemDeComentario(comentario: ComentarioDeSugestao): HTMLElement {
  return el('li', {},
    el('div', { class: 'meta' }, el('strong', {}, comentario.autor_nome), ` · ${dataEHora(comentario.criado_em)}`),
    el('p', {}, comentario.texto));
}

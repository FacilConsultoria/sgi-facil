// Documentos gerais: Estatuto, relatórios e outros arquivos da Fácil, por categoria. Quem pode enviar e excluir
// chega pronto do banco (permissoes_documentos e pode_excluir); trainees não recebem a lista.
import type { ContextoDaSessao } from '../../app/sessao';
import { dataCurta } from '../../lib/datas';
import type { CategoriaDeDocumento, DocumentoDoPainel } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { el, substituir } from '../../ui/dom';
import { abrirJanela, campo, executarAcao, ligarEnvio, linhaDeErro, rodapeDaJanela, seletor } from '../../ui/formulario';
import { montarRecarregavel } from '../../ui/recarregavel';
import { carregarDocumentos, enderecoDoDocumento, enviarDocumento, removerDocumento, type DadosDosDocumentos } from './dados';

const CATEGORIAS: readonly { id: CategoriaDeDocumento; nome: string }[] = [
  { id: 'estatuto', nome: 'Estatuto' },
  { id: 'relatorio', nome: 'Relatórios' },
  { id: 'regimento', nome: 'Regimentos e políticas' },
  { id: 'ata', nome: 'Atas' },
  { id: 'modelo', nome: 'Modelos' },
  { id: 'outro', nome: 'Outros' },
];

const LIMITE_EM_BYTES = 50 * 1024 * 1024;

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export function paginaDocumentos(destino: HTMLElement, _contexto: ContextoDaSessao): void {
  const botoes = el('div', { class: 'linha' });
  const corpo = el('div', {});
  substituir(destino,
    el('section', { class: 'cab' },
      el('div', {}, el('h1', {}, 'Documentos'), el('p', { class: 'sub' }, 'Estatuto, relatórios e outros documentos gerais da Fácil.')),
      botoes),
    corpo);

  montarRecarregavel<DadosDosDocumentos>(corpo, {
    carregar: carregarDocumentos,
    operacao: 'Carregar documentos',
    textoDeCarregando: 'Carregando documentos…',
    desenhar: (dados, recarregar): HTMLElement[] => {
      substituir(botoes);
      if (dados.podeEnviar) {
        const enviar = el('button', { type: 'button', class: 'btn prim' }, 'Enviar documento');
        enviar.addEventListener('click', () => abrirEnvio(destino, recarregar));
        botoes.append(enviar);
      }
      if (dados.documentos.length === 0) {
        return [el('p', { class: 'vazio' }, dados.podeEnviar ? 'Nenhum documento ainda. Use “Enviar documento” para começar pelo Estatuto.' : 'Nenhum documento ainda.')];
      }
      return CATEGORIAS
        .map((categoria) => ({ categoria, lista: dados.documentos.filter((d) => d.categoria === categoria.id) }))
        .filter((grupo) => grupo.lista.length > 0)
        .map((grupo) => el('section', { class: 'bloco documentos' },
          el('h2', {}, grupo.categoria.nome),
          el('ul', { class: 'lista-documentos' }, ...grupo.lista.map((d) => itemDoDocumento(d, recarregar)))));
    },
  });
}

function itemDoDocumento(documento: DocumentoDoPainel, recarregar: () => Promise<void>): HTMLElement {
  const erro = linhaDeErro();
  const abrir = el('button', { type: 'button', class: 'btn peq' }, 'Abrir');
  abrir.addEventListener('click', () => {
    // a janela abre já, para o navegador não bloquear; o endereço chega em seguida
    const janela = window.open('', '_blank');
    void executarAcao({
      botao: abrir, erro, operacao: 'Abrir documento',
      acao: async () => {
        const endereco = await enderecoDoDocumento(documento);
        if (janela) janela.location.href = endereco;
        else window.location.href = endereco;
      },
    }).then((ok) => { if (!ok) janela?.close(); });
  });
  const acoes = el('div', { class: 'linha' }, abrir);
  if (documento.pode_excluir) {
    const excluir = el('button', { type: 'button', class: 'btn peq perigo' }, 'Excluir');
    excluir.addEventListener('click', () => {
      if (!window.confirm(`Excluir "${documento.titulo}"? O arquivo é apagado e não dá para desfazer.`)) return;
      void executarAcao({ botao: excluir, erro, operacao: 'Excluir documento', acao: () => removerDocumento(documento.id) })
        .then(async (ok) => {
          if (!ok) return;
          mostrarAviso('Documento excluído');
          await recarregar();
        });
    });
    acoes.append(excluir);
  }
  return el('li', { class: 'documento' },
    el('div', { class: 'documento-info' },
      el('strong', {}, documento.titulo),
      documento.descricao ? el('p', {}, documento.descricao) : null,
      el('span', { class: 'meta' },
        `${documento.nome_arquivo} · ${tamanhoLegivel(documento.tamanho)} · ${dataCurta(documento.enviado_em.slice(0, 10))}`
        + (documento.enviado_por_nome ? ` · ${documento.enviado_por_nome}` : ''))),
    acoes,
    erro.elemento);
}

function abrirEnvio(pai: HTMLElement, recarregar: () => Promise<void>): void {
  abrirJanela(pai, 'documento-titulo', 'Enviar documento', (fechar) => {
    const titulo = el('input', { type: 'text', id: 'doc-titulo', maxlength: '150', placeholder: 'Ex.: Estatuto social (versão 2026)' });
    const categoria = seletor<CategoriaDeDocumento>('doc-categoria', CATEGORIAS, 'estatuto');
    const descricao = el('textarea', { id: 'doc-descricao', maxlength: '1000', rows: '3', placeholder: 'Opcional: do que se trata, período, aprovação' });
    const arquivo = el('input', { type: 'file', id: 'doc-arquivo' });
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Enviar');
    const erro = linhaDeErro();
    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        campo('Título', titulo),
        campo('Categoria', categoria),
        campo('Descrição', descricao),
        campo('Arquivo', arquivo),
        el('p', { class: 'dica' }, 'PDF, Word, planilhas, apresentações ou imagens, até 50 MB. Todos os membros (menos trainees) podem abrir.'),
        erro.elemento),
      rodapeDaJanela(fechar, botao));
    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Enviar documento',
      validar: () => {
        if (!titulo.value.trim()) return 'Dê um título ao documento.';
        const escolhido = arquivo.files?.[0];
        if (!escolhido) return 'Escolha o arquivo.';
        return escolhido.size > LIMITE_EM_BYTES ? 'O arquivo precisa ter até 50 MB.' : null;
      },
      acao: () => enviarDocumento({
        titulo: titulo.value.trim(),
        categoria: categoria.value as CategoriaDeDocumento,
        descricao: descricao.value.trim(),
        arquivo: arquivo.files?.[0] as File,
      }),
      depois: async () => {
        fechar();
        mostrarAviso('Documento enviado');
        await recarregar();
      },
    });
    queueMicrotask(() => titulo.focus());
    return formulario;
  });
}

// Janelas de cadastro do módulo de Demandas: nova demanda e novo projeto.
// As listas (projetos, núcleos, executores) vêm das visões do banco, já limitadas ao que a pessoa pode usar.
import { somarDias } from '../../lib/datas';
import type { Prioridade } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { el, substituir } from '../../ui/dom';
import { abrirJanela, campo, ligarEnvio, linhaDeErro, rodapeDaJanela, seletor } from '../../ui/formulario';
import { camposDeRaci, raciParaGravar } from './campos-raci';
import { seletorDeExecutores, type SeletorDeExecutores } from './componentes';
import type { ContextoDeDemandas } from './contexto';
import { criarDemanda, criarProjeto } from './dados';
import { abrirPainelDaDemanda } from './painel';
import { validarRaci } from './raci';
import { agruparExecutores, PRIORIDADES, validarDemanda } from './regras';

/** Janela de cadastro da tela de Demandas (a estrutura comum fica em ui/formulario). */
function janela(
  contexto: ContextoDeDemandas,
  idDoTitulo: string,
  titulo: string,
  montarFormulario: (fechar: () => void) => HTMLFormElement,
): void {
  abrirJanela(contexto.pagina, idDoTitulo, titulo, montarFormulario);
}

const rodape = rodapeDaJanela;

export function abrirNovaDemanda(contexto: ContextoDeDemandas, projetoInicial?: string): void {
  const { dados, perfil, hoje } = contexto;
  const projetos = dados.projetos.filter((p) => p.pode_criar_demanda);
  const inicial = projetos.find((p) => p.id === projetoInicial) ?? projetos[0];
  if (!inicial) {
    mostrarAviso('Você não tem projetos em que possa criar demandas.', 'erro');
    return;
  }

  janela(contexto, 'nova-demanda-titulo', 'Nova demanda', (fechar) => {
    const projeto = el('select', { id: 'nd-projeto' },
      ...projetos.map((p) => el('option', { value: p.id, selected: p.id === inicial.id },
        [p.nome, p.cliente].filter(Boolean).join(' · '))));
    const titulo = el('input', { type: 'text', id: 'nd-titulo', maxlength: '120', placeholder: 'Ex.: Levantar notas fiscais de outubro' });
    const descricao = el('textarea', { id: 'nd-descricao', placeholder: 'Entregável, critério de pronto, referências' });
    const prazo = el('input', { type: 'date', id: 'nd-prazo', value: somarDias(hoje, 7), min: hoje });
    const prioridade = seletor<Prioridade>('nd-prioridade', PRIORIDADES, 'media');
    const restrita = el('input', { type: 'checkbox', id: 'nd-restrita' });
    const linhaRestrita = el('label', { class: 'check', for: 'nd-restrita' }, restrita, ' Restringir à Presidência (oculta das diretorias e núcleos)');
    const areaExecutores = el('div', {});
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Criar demanda');
    const erro = linhaDeErro();

    // a lista de executores depende do núcleo do projeto escolhido; marcações já feitas são mantidas
    let executores: SeletorDeExecutores = seletorDeExecutores('nd', [], []);
    const projetoEscolhido = (): typeof inicial => projetos.find((p) => p.id === projeto.value) ?? inicial;
    const raci = camposDeRaci({
      prefixo: 'nd',
      dados,
      projetoId: () => projeto.value,
      restrita: () => projetoEscolhido().restrito || (!linhaRestrita.hidden && restrita.checked),
      executores: () => executores.marcados(),
    });
    const montarExecutores = (): void => {
      const escolhido = projetoEscolhido();
      const marcados = executores.marcados();
      executores = seletorDeExecutores('nd', agruparExecutores(dados.atribuiveis, escolhido.nucleo_id, [], dados.nomeDe), marcados);
      executores.elemento.addEventListener('change', raci.atualizar);
      substituir(areaExecutores, executores.elemento);
      linhaRestrita.hidden = !(perfil.eh_presidencia && !escolhido.restrito);
      raci.atualizar();
    };
    montarExecutores();
    projeto.addEventListener('change', montarExecutores);
    restrita.addEventListener('change', raci.atualizar);

    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        campo('Projeto', projeto),
        campo('Título', titulo),
        campo('Descrição', descricao),
        el('div', { class: 'dois' }, campo('Prazo', prazo), campo('Prioridade', prioridade)),
        linhaRestrita,
        el('h3', { class: 'titulo-raci' }, 'Matriz RACI'),
        areaExecutores,
        el('p', { class: 'dica' }, 'Quem executa passa a ver esta demanda, mesmo que seja de outro núcleo.'),
        raci.aprovador,
        raci.alcance,
        erro.elemento),
      rodape(fechar, botao));

    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Criar demanda',
      validar: () => validarDemanda({ titulo: titulo.value, prazo: prazo.value, executores: executores.marcados() })
        ?? validarRaci({ executores: executores.marcados(), ...raci.ler() }),
      acao: () => criarDemanda({
        projetoId: projeto.value,
        titulo: titulo.value.trim(),
        descricao: descricao.value.trim(),
        prazo: prazo.value,
        prioridade: prioridade.value as Prioridade,
        executores: executores.marcados(),
        restrita: !linhaRestrita.hidden && restrita.checked,
        raci: raciParaGravar(raci.ler()),
      }),
      depois: async (id) => {
        fechar();
        mostrarAviso('Demanda criada');
        const atualizado = await contexto.recarregar();
        const criada = atualizado?.dados.demandas.find((d) => d.id === id);
        if (atualizado && criada) abrirPainelDaDemanda(atualizado, criada);
      },
    });
    queueMicrotask(() => titulo.focus());
    return formulario;
  });
}

export function abrirNovoProjeto(contexto: ContextoDeDemandas): void {
  const { dados, perfil, tituloDaArea } = contexto;
  const nucleos = dados.nucleos.filter((n) => n.pode_criar_projeto);
  if (nucleos.length === 0) {
    mostrarAviso('Você não tem núcleos em que possa criar projetos.', 'erro');
    return;
  }

  janela(contexto, 'novo-projeto-titulo', 'Novo projeto', (fechar) => {
    const nome = el('input', { type: 'text', id: 'np-nome', maxlength: '120', placeholder: 'Ex.: Mapeamento de processos' });
    const cliente = el('input', { type: 'text', id: 'np-cliente', maxlength: '120', placeholder: 'Cliente ou "Interno"' });
    const nucleo = el('select', { id: 'np-nucleo' },
      ...nucleos.map((n) => el('option', { value: n.id }, `${n.nome} · ${tituloDaArea(n.area_id)}`)));
    const restrito = el('input', { type: 'checkbox', id: 'np-restrito' });
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Criar projeto');
    const erro = linhaDeErro();

    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        campo('Nome do projeto', nome),
        campo('Cliente', cliente),
        campo('Núcleo responsável', nucleo),
        perfil.eh_presidencia
          ? el('label', { class: 'check', for: 'np-restrito' }, restrito, ' Restringir à Presidência (oculta das diretorias e núcleos)')
          : null,
        el('p', { class: 'dica' }, 'Depois de criar o projeto, você já pode cadastrar a primeira demanda dele.'),
        erro.elemento),
      rodape(fechar, botao));

    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Criar projeto',
      validar: () => (nome.value.trim() ? null : 'Dê um nome ao projeto.'),
      acao: () => criarProjeto({
        nome: nome.value.trim(),
        cliente: cliente.value.trim(),
        nucleoId: nucleo.value,
        restrito: perfil.eh_presidencia && restrito.checked,
      }),
      depois: async (id) => {
        fechar();
        mostrarAviso('Projeto criado');
        const atualizado = await contexto.recarregar();
        if (atualizado?.dados.projetos.some((p) => p.id === id && p.pode_criar_demanda)) abrirNovaDemanda(atualizado, id);
      },
    });
    queueMicrotask(() => nome.focus());
    return formulario;
  });
}

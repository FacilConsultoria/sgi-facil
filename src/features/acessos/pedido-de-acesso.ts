// Janelas do módulo de Acessos: pedir acesso por exceção e, na Assessoria de Presidência,
// pedir aval da Presidente ou da Vice para decidir um pedido.
import { hojeEmSaoPaulo } from '../../lib/datas';
import { mostrarAviso } from '../../ui/aviso';
import { el, substituir } from '../../ui/dom';
import { abrirJanela, campo, ligarEnvio, linhaDeErro, rodapeDaJanela } from '../../ui/formulario';
import { carregarProjetosSolicitaveis, pedirAcesso, pedirAvalDeDecisao, type DadosDosAcessos } from './dados';
import { limitesDaValidade, resumoDoPedidoDeAvalDeDecisao, validarPedidoDeAcesso } from './regras';
import type { AlvoDeSolicitacao, SolicitacaoVisivel } from '../../types/database';
import { registrarErro, mensagemParaUsuario } from '../../lib/erros';

export interface ContextoDosAcessos {
  /** Onde as janelas são montadas (fora do conteúdo, que é redesenhado). */
  pagina: HTMLElement;
  dados: DadosDosAcessos;
  recarregar: () => Promise<void>;
}

export function abrirPedidoDeAcesso(contexto: ContextoDosAcessos): void {
  const { dados } = contexto;
  if (dados.beneficiarios.length === 0) {
    mostrarAviso('Você não pode pedir acesso para ninguém.', 'erro');
    return;
  }
  const hoje = hojeEmSaoPaulo();
  const limites = limitesDaValidade(hoje);

  abrirJanela(contexto.pagina, 'pedido-acesso-titulo', 'Pedir acesso por exceção', (fechar) => {
    const unico = dados.beneficiarios.length === 1 ? dados.beneficiarios[0] : undefined;
    const beneficiario = el('select', { id: 'pac-pessoa' },
      el('option', { value: '' }, 'Escolha a pessoa…'),
      ...dados.beneficiarios.map((p) => el('option', { value: p.id, selected: p.id === unico?.id }, p.nome)));
    const alvo = el('select', { id: 'pac-alvo' },
      el('option', { value: 'projeto' }, 'Um projeto'),
      el('option', { value: 'demanda' }, 'Uma demanda'));
    const projeto = el('select', { id: 'pac-projeto' }, el('option', { value: '' }, 'Escolha antes a pessoa'));
    const blocoDoProjeto = el('div', {}, el('label', { for: 'pac-projeto' }, 'Projeto'), projeto);
    const codigo = el('input', { type: 'text', id: 'pac-codigo', maxlength: '20', placeholder: 'Ex.: PRJ-001' });
    const blocoDaDemanda = el('div', { hidden: true }, el('label', { for: 'pac-codigo' }, 'Código da demanda'), codigo);
    const justificativa = el('textarea', { id: 'pac-justificativa', placeholder: 'Por que esta pessoa precisa deste acesso? (mínimo 20 caracteres)' });
    const validade = el('input', { type: 'date', id: 'pac-validade', value: limites.padrao, min: limites.minimo, max: limites.maximo });
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Enviar pedido');
    const erro = linhaDeErro();

    // projetos pedíveis dependem da pessoa; busca de novo a cada troca e descarta respostas antigas
    let busca = 0;
    const carregarProjetos = (): void => {
      const minha = ++busca;
      if (!beneficiario.value) {
        substituir(projeto, el('option', { value: '' }, 'Escolha antes a pessoa'));
        return;
      }
      substituir(projeto, el('option', { value: '' }, 'Carregando…'));
      carregarProjetosSolicitaveis(beneficiario.value)
        .then((projetos) => {
          if (minha !== busca) return;
          substituir(projeto,
            el('option', { value: '' }, projetos.length ? 'Escolha o projeto…' : 'Nenhum projeto disponível para pedir'),
            ...projetos.map((p) => el('option', { value: p.id }, [p.nome, p.cliente].filter(Boolean).join(' · '))));
        })
        .catch((falha: unknown) => {
          if (minha !== busca) return;
          registrarErro('Carregar projetos solicitáveis', falha);
          substituir(projeto, el('option', { value: '' }, 'Não foi possível carregar'));
          erro.mostrar(mensagemParaUsuario(falha));
        });
    };
    beneficiario.addEventListener('change', carregarProjetos);
    alvo.addEventListener('change', () => {
      blocoDoProjeto.hidden = alvo.value !== 'projeto';
      blocoDaDemanda.hidden = alvo.value !== 'demanda';
    });
    carregarProjetos();

    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        campo('Para quem', beneficiario),
        campo('O que se pede', alvo),
        blocoDoProjeto, blocoDaDemanda,
        campo('Justificativa', justificativa),
        campo('Válido até', validade),
        el('p', { class: 'dica' }, 'O acesso é só para consulta e vale no máximo 90 dias. Quem decide é a diretoria da área ou a Presidência; itens restritos só a Presidente aprova.'),
        erro.elemento),
      rodapeDaJanela(fechar, botao));

    const campos = () => ({
      beneficiario: beneficiario.value, alvo: alvo.value as AlvoDeSolicitacao, projeto: projeto.value,
      codigo: codigo.value, justificativa: justificativa.value, validade: validade.value,
    });
    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Pedir acesso por exceção',
      validar: () => validarPedidoDeAcesso(campos(), hoje),
      acao: () => {
        const preenchidos = campos();
        return pedirAcesso({
          beneficiarioId: preenchidos.beneficiario,
          alvo: preenchidos.alvo,
          projetoId: preenchidos.alvo === 'projeto' ? preenchidos.projeto : null,
          codigoDaDemanda: preenchidos.alvo === 'demanda' ? preenchidos.codigo.trim() : null,
          justificativa: preenchidos.justificativa.trim(),
          validoAte: preenchidos.validade,
        });
      },
      depois: async () => {
        fechar();
        mostrarAviso('Pedido enviado');
        await contexto.recarregar();
      },
    });
    queueMicrotask(() => beneficiario.focus());
    return formulario;
  });
}

/** Assessoria de Presidência: a decisão dela sobre o pedido só vale depois do aval da Presidente ou da Vice. */
export function abrirPedidoDeAvalDeDecisao(contexto: ContextoDosAcessos, solicitacao: SolicitacaoVisivel, aprovar: boolean): void {
  const { dados } = contexto;
  const beneficiario = dados.nomeDe(solicitacao.beneficiario);
  abrirJanela(contexto.pagina, 'aval-decisao-titulo', aprovar ? 'Pedir aval para aprovar' : 'Pedir aval para negar', (fechar) => {
    const nota = el('textarea', { id: 'ad-nota', placeholder: 'Observação (opcional)' });
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Enviar pedido de aval');
    const erro = linhaDeErro();
    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' },
        el('p', { class: 'dica' },
          `Você ${aprovar ? 'aprovaria' : 'negaria'} o acesso de ${beneficiario} a ${solicitacao.alvo_nome}. Como Assessoria de Presidência, a decisão só vale depois que a Presidente ou a Vice aprovarem este pedido na aba Avais.`),
        campo('Observação', nota),
        erro.elemento),
      rodapeDaJanela(fechar, botao));
    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Pedir aval para decidir acesso',
      acao: () => pedirAvalDeDecisao(solicitacao.id, aprovar, nota.value.trim(),
        resumoDoPedidoDeAvalDeDecisao(aprovar, beneficiario, solicitacao.alvo_nome, nota.value)),
      depois: async () => {
        fechar();
        mostrarAviso('Pedido de aval enviado');
        await contexto.recarregar();
      },
    });
    queueMicrotask(() => nota.focus());
    return formulario;
  });
}

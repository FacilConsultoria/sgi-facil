// Janela "Meus dados pessoais": cada pessoa preenche e altera só os próprios dados. Quem ainda não preencheu vê
// o ícone de pendência no menu e na Tela Inicial; ao salvar, a pendência some em todo o sistema.
import { hojeEmSaoPaulo } from '../../lib/datas';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import type { Perfil } from '../../types/database';
import { mostrarAviso } from '../../ui/aviso';
import { el } from '../../ui/dom';
import { abrirJanela, ligarEnvio, linhaDeErro, rodapeDaJanela } from '../../ui/formulario';
import { montarCamposDeDadosPessoais } from './campos';
import { carregarDadosDe, salvarMeusDados } from './dados';
import { camposDosDados, prepararDados, validarDadosPessoais } from './regras';

/** Avisado (em window) quando a pessoa salva os dados; menu e Tela Inicial tiram a pendência. */
export const EVENTO_DADOS_SALVOS = 'sgi:dados-pessoais-salvos';

export async function abrirMeusDados(pai: HTMLElement, perfil: Perfil): Promise<void> {
  let inicial = null;
  try {
    inicial = await carregarDadosDe(perfil.id);
  } catch (erro: unknown) {
    registrarErro('Carregar dados pessoais', erro);
    mostrarAviso(mensagemParaUsuario(erro), 'erro');
    return;
  }
  const hoje = hojeEmSaoPaulo();

  abrirJanela(pai, 'dados-pessoais-titulo', 'Meus dados pessoais', (fechar) => {
    const campos = montarCamposDeDadosPessoais(inicial ? camposDosDados(inicial) : undefined);
    const botao = el('button', { type: 'submit', class: 'btn prim' }, 'Salvar');
    const erro = linhaDeErro();
    const formulario = el('form', { class: 'form-janela', novalidate: true },
      el('div', { class: 'painel-corpo form' }, ...campos.elementos, erro.elemento),
      rodapeDaJanela(fechar, botao));

    ligarEnvio({
      formulario, botao, erro,
      operacao: 'Salvar dados pessoais',
      validar: () => validarDadosPessoais(campos.ler(), hoje),
      acao: () => {
        const dados = prepararDados(campos.ler(), hoje);
        if (!dados) throw new Error('Dados pessoais inválidos.');
        return salvarMeusDados(dados);
      },
      depois: () => {
        fechar();
        perfil.dados_pendentes = false;
        window.dispatchEvent(new CustomEvent(EVENTO_DADOS_SALVOS));
        mostrarAviso('Dados salvos');
      },
    });
    queueMicrotask(() => campos.focar());
    return formulario;
  });
}

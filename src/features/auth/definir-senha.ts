// Criação de senha: no primeiro acesso (depois do link do e-mail) ou ao redefinir a senha esquecida.
// No primeiro acesso o formulário também pede os dados pessoais, e a senha fica no fim.
// Enquanto a senha não for salva, o sistema não abre (decidido em main.ts).
import { hojeEmSaoPaulo } from '../../lib/datas';
import { mensagemParaUsuario, registrarErro } from '../../lib/erros';
import { el, substituir } from '../../ui/dom';
import { molduraDeAcesso } from '../../ui/moldura-acesso';
import { montarCamposDeDadosPessoais } from '../dadospessoais/campos';
import { prepararDados, validarDadosPessoais, type DadosParaSalvar } from '../dadospessoais/regras';
import { TAMANHO_MINIMO_DA_SENHA, validarNovaSenha } from './regras';

export interface OpcoesDeCriarSenha {
  email: string;
  /** Verdadeiro quando veio de "Esqueci minha senha": só a senha, sem os dados pessoais; muda também os textos. */
  recuperacao: boolean;
  /** `dados` vem preenchido no primeiro acesso e nulo na recuperação de senha. */
  salvar: (senha: string, dados: DadosParaSalvar | null) => Promise<void>;
  aoSair: () => void;
}

export function paginaDefinirSenha(raiz: HTMLElement, opcoes: OpcoesDeCriarSenha): void {
  // campo de usuário invisível: faz o gerenciador de senhas do navegador salvar a senha junto com o e-mail
  const usuario = el('input', { type: 'email', name: 'email', autocomplete: 'username', value: opcoes.email, readonly: true, tabindex: '-1', class: 'sr', 'aria-hidden': 'true' });
  const campoSenha = el('input', { type: 'password', id: 'nova-senha', name: 'nova-senha', autocomplete: 'new-password', required: true });
  const campoConfirmacao = el('input', { type: 'password', id: 'nova-senha-confirmacao', name: 'nova-senha-confirmacao', autocomplete: 'new-password', required: true });
  const botao = el('button', { type: 'submit', class: 'btn prim largo' }, 'Salvar senha');
  const mensagem = el('p', { class: 'mensagem-form erro', role: 'alert' });
  const sair = el('button', { type: 'button', class: 'btn-link' }, 'Sair');
  sair.addEventListener('click', opcoes.aoSair);

  // os dados pessoais vêm antes da senha, que fica no fim do formulário
  const dados = opcoes.recuperacao ? null : montarCamposDeDadosPessoais();
  const hoje = hojeEmSaoPaulo();

  const formulario = el('form', { class: 'form', novalidate: true },
    usuario,
    ...(dados ? [el('h2', { class: 'secao-do-form' }, 'Seus dados'), ...dados.elementos, el('h2', { class: 'secao-do-form' }, 'Sua senha')] : []),
    el('div', {}, el('label', { for: 'nova-senha' }, 'Nova senha'), campoSenha),
    el('div', {}, el('label', { for: 'nova-senha-confirmacao' }, 'Repita a senha'), campoConfirmacao),
    botao, mensagem,
    el('div', { class: 'acoes-secundarias' }, sair));

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const camposDigitados = dados?.ler();
    const problemaNosDados = camposDigitados ? validarDadosPessoais(camposDigitados, hoje) : null;
    if (problemaNosDados) {
      mensagem.textContent = problemaNosDados;
      dados?.focar();
      return;
    }
    const problema = validarNovaSenha(campoSenha.value, campoConfirmacao.value);
    if (problema) {
      mensagem.textContent = problema;
      campoSenha.focus();
      return;
    }
    mensagem.textContent = '';
    botao.disabled = true;
    // com sucesso, main.ts troca esta tela pelo sistema
    opcoes.salvar(campoSenha.value, camposDigitados ? prepararDados(camposDigitados, hoje) : null)
      .catch((erro: unknown) => {
        registrarErro('Criar senha', erro);
        mensagem.textContent = mensagemParaUsuario(erro);
        botao.disabled = false;
      });
  });

  substituir(raiz, molduraDeAcesso(
    el('h1', {}, opcoes.recuperacao ? 'Crie uma nova senha' : 'Complete seu cadastro'),
    el('p', {}, opcoes.recuperacao
      ? `Use pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres, com letras e números. Nos próximos acessos você entra com ${opcoes.email} e esta senha.`
      : `Preencha seus dados e, no fim, crie a senha (pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres, com letras e números). Nos próximos acessos você entra com ${opcoes.email} e esta senha.`),
    formulario,
  ));
  (dados ?? { focar: () => campoSenha.focus() }).focar();
}

// Validações do login: e-mail (o banco compara e-mails sempre em minúsculas) e senha.

export const TAMANHO_MINIMO_DA_SENHA = 10;

/** Marca gravada no cadastro de acesso quando a pessoa já criou a própria senha. */
export const CHAVE_SENHA_DEFINIDA = 'senha_definida';

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailValido(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Falso no primeiro acesso: a pessoa entrou pelo link do e-mail e ainda não tem senha. */
export function senhaJaDefinida(metadados: Record<string, unknown> | null | undefined): boolean {
  return metadados?.[CHAVE_SENHA_DEFINIDA] === true;
}

/** Texto do problema com a nova senha, ou null se estiver boa. */
export function validarNovaSenha(senha: string, confirmacao: string): string | null {
  if (senha.length < TAMANHO_MINIMO_DA_SENHA) return `A senha precisa ter pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`;
  if (senha.length > 72) return 'A senha pode ter no máximo 72 caracteres.';
  if (!/[A-Za-z]/.test(senha) || !/[0-9]/.test(senha)) return 'Misture letras e números na senha.';
  if (senha !== confirmacao) return 'As duas senhas não são iguais.';
  return null;
}

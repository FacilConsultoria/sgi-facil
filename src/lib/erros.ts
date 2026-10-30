// Tradução de erros técnicos em mensagens para quem usa o sistema (diretrizes §8.1).
// Detalhes técnicos vão para o console; a interface nunca mostra stack trace nem SQL.

/** Código SQLSTATE das mensagens de negócio lançadas pelas funções do banco (raise exception). */
const CODIGO_REGRA_DE_NEGOCIO = 'P0001';

const MENSAGEM_GENERICA = 'Algo deu errado. Tente de novo; se continuar, avise a Gente e Gestão.';

interface ErroComDetalhes {
  message?: unknown;
  code?: unknown;
  status?: unknown;
}

function comoObjeto(erro: unknown): ErroComDetalhes {
  return typeof erro === 'object' && erro !== null ? (erro as ErroComDetalhes) : {};
}

export function mensagemParaUsuario(erro: unknown): string {
  const { message, code, status } = comoObjeto(erro);
  const texto = typeof message === 'string' ? message : '';

  if (code === CODIGO_REGRA_DE_NEGOCIO && texto) return texto;
  if (status === 429) return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(texto)) {
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(texto)) {
    return 'E-mail ou senha incorretos. No primeiro acesso, ou se esqueceu a senha, receba um link de acesso.';
  }
  if (code === 'same_password' || /different from the old password/i.test(texto)) return 'A nova senha precisa ser diferente da anterior.';
  if (code === 'weak_password' || /password should (be|contain)|weak password/i.test(texto)) {
    return 'Senha fraca. Escolha uma senha mais forte, com letras e números.';
  }
  if (/error sending .*email|email_address_not_authorized|email address not authorized/i.test(texto) || code === 'email_address_not_authorized') {
    return 'Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos; se continuar, avise a Gente e Gestão.';
  }
  if (/jwt expired|invalid jwt|refresh token|auth session missing/i.test(texto)) return 'Sua sessão expirou. Entre novamente.';
  if (code === '42501' || /permission denied|row-level security/i.test(texto)) {
    return 'Você não tem permissão para esta ação.';
  }
  return MENSAGEM_GENERICA;
}

/** Registra o erro completo para diagnóstico, com o contexto da operação. */
export function registrarErro(contexto: string, erro: unknown): void {
  console.error(`[SGI] ${contexto}`, erro);
}

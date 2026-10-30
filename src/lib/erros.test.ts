import { describe, expect, it } from 'vitest';
import { mensagemParaUsuario } from './erros';

describe('mensagemParaUsuario', () => {
  it('repassa mensagens de regra de negócio vindas do banco', () => {
    const erro = { code: 'P0001', message: 'Ninguém ajusta a própria pontuação.' };
    expect(mensagemParaUsuario(erro)).toBe('Ninguém ajusta a própria pontuação.');
  });

  it('não expõe mensagens técnicas do banco', () => {
    const erro = { code: '42883', message: 'function public.x(uuid) does not exist' };
    expect(mensagemParaUsuario(erro)).toBe('Algo deu errado. Tente de novo; se continuar, avise a Gente e Gestão.');
  });

  it('traduz falta de permissão', () => {
    expect(mensagemParaUsuario({ code: '42501', message: 'permission denied for table demandas' })).toBe(
      'Você não tem permissão para esta ação.',
    );
  });

  it('traduz falha de rede', () => {
    expect(mensagemParaUsuario(new TypeError('Failed to fetch'))).toBe(
      'Sem conexão com o servidor. Verifique a internet e tente de novo.',
    );
  });

  it('traduz excesso de tentativas de login', () => {
    expect(mensagemParaUsuario({ status: 429, message: 'For security purposes, you can only request this after 60 seconds.' })).toBe(
      'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.',
    );
  });

  it('traduz os erros de login por senha', () => {
    expect(mensagemParaUsuario({ status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(
      'E-mail ou senha incorretos. No primeiro acesso, ou se esqueceu a senha, receba um link de acesso.',
    );
    expect(mensagemParaUsuario({ code: 'same_password', message: 'New password should be different from the old password.' })).toBe(
      'A nova senha precisa ser diferente da anterior.',
    );
    expect(mensagemParaUsuario({ code: 'weak_password', message: 'Password should be at least 6 characters.' })).toBe(
      'Senha fraca. Escolha uma senha mais forte, com letras e números.',
    );
  });

  it('traduz falha no envio do e-mail de acesso', () => {
    expect(mensagemParaUsuario({ status: 500, message: 'Error sending magic link email' })).toBe(
      'Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos; se continuar, avise a Gente e Gestão.',
    );
    expect(mensagemParaUsuario({ status: 400, code: 'email_address_not_authorized', message: 'Email address not authorized' })).toBe(
      'Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos; se continuar, avise a Gente e Gestão.',
    );
  });

  it('trata sessão ausente como sessão expirada', () => {
    expect(mensagemParaUsuario({ message: 'Auth session missing!' })).toBe('Sua sessão expirou. Entre novamente.');
  });

  it('trata valores que não são erros', () => {
    expect(mensagemParaUsuario(undefined)).toBe('Algo deu errado. Tente de novo; se continuar, avise a Gente e Gestão.');
  });
});

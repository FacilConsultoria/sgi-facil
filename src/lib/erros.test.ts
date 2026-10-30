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

  it('trata valores que não são erros', () => {
    expect(mensagemParaUsuario(undefined)).toBe('Algo deu errado. Tente de novo; se continuar, avise a Gente e Gestão.');
  });
});

import { describe, expect, it } from 'vitest';
import {
  calcularIdade, camposDosDados, cpfValido, dataDoISO, dataParaISO, descreverNascimento, formatarCpf, mascararCpf, mascararData,
  nomeDoGenero, normalizarNome, normalizarRga, prepararDados, validarDadosPessoais, type CamposDigitados,
} from './regras';

const HOJE = '2026-11-02';

const campos = (alteracao: Partial<CamposDigitados> = {}): CamposDigitados => ({
  nomeCompleto: 'Ana Ferraz de Souza', rga: '2020.1904.0123', cpf: '529.982.247-25', nascimento: '09/04/2003', genero: 'feminino', ...alteracao,
});

describe('máscaras', () => {
  it('põe pontos e traço no CPF enquanto a pessoa digita só números', () => {
    expect(mascararCpf('5')).toBe('5');
    expect(mascararCpf('5299')).toBe('529.9');
    expect(mascararCpf('529982')).toBe('529.982');
    expect(mascararCpf('5299822')).toBe('529.982.2');
    expect(mascararCpf('52998224725')).toBe('529.982.247-25');
    expect(mascararCpf('529.982.247-25')).toBe('529.982.247-25');
    expect(mascararCpf('52998224725999')).toBe('529.982.247-25');
    expect(mascararCpf('')).toBe('');
  });

  it('põe as barras na data', () => {
    expect(mascararData('0')).toBe('0');
    expect(mascararData('0904')).toBe('09/04');
    expect(mascararData('09042003')).toBe('09/04/2003');
    expect(mascararData('09/04/2003')).toBe('09/04/2003');
    expect(mascararData('090420031')).toBe('09/04/2003');
  });

  it('formata o CPF guardado e deixa outro texto como está', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
    expect(formatarCpf('abc')).toBe('abc');
  });
});

describe('normalização', () => {
  it('RGA sem pontuação e em maiúsculas; nome sem espaços repetidos', () => {
    expect(normalizarRga('ab12.34 56789-0')).toBe('AB1234567890');
    expect(normalizarNome('  Ana   Ferraz  de Souza ')).toBe('Ana Ferraz de Souza');
  });
});

describe('cpfValido', () => {
  it('confere os dígitos verificadores, com ou sem pontuação', () => {
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('11144477735')).toBe(true);
    expect(cpfValido('52998224726')).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido('123')).toBe(false);
    expect(cpfValido('')).toBe(false);
  });
});

describe('dataParaISO', () => {
  it('converte datas de calendário válidas', () => {
    expect(dataParaISO('09/04/2003', HOJE)).toBe('2003-04-09');
    expect(dataParaISO('29/02/2004', HOJE)).toBe('2004-02-29');
    expect(dataParaISO('02/11/2026', HOJE)).toBe('2026-11-02');
  });

  it('recusa data inexistente, no futuro, antes de 1930 ou fora do formato', () => {
    expect(dataParaISO('29/02/2003', HOJE)).toBe(null);
    expect(dataParaISO('31/04/2003', HOJE)).toBe(null);
    expect(dataParaISO('00/10/2003', HOJE)).toBe(null);
    expect(dataParaISO('03/11/2026', HOJE)).toBe(null);
    expect(dataParaISO('01/01/1929', HOJE)).toBe(null);
    expect(dataParaISO('9/4/2003', HOJE)).toBe(null);
    expect(dataParaISO('2003-04-09', HOJE)).toBe(null);
  });

  it('volta de ISO para dd/mm/aaaa', () => {
    expect(dataDoISO('2003-04-09')).toBe('09/04/2003');
  });
});

describe('idade', () => {
  it('conta anos completos', () => {
    expect(calcularIdade('2003-04-09', '2026-04-08')).toBe(22);
    expect(calcularIdade('2003-04-09', '2026-04-09')).toBe(23);
    expect(calcularIdade('2003-04-09', '2026-11-02')).toBe(23);
    expect(calcularIdade('2003-12-31', '2026-11-02')).toBe(22);
  });

  it('descreve data e idade', () => {
    expect(descreverNascimento('2003-04-09', HOJE)).toBe('09/04/2003 · 23 anos');
    expect(descreverNascimento('2025-11-02', HOJE)).toBe('02/11/2025 · 1 ano');
  });
});

describe('validarDadosPessoais', () => {
  it('aceita os dados corretos', () => {
    expect(validarDadosPessoais(campos(), HOJE)).toBe(null);
  });

  it('aponta o primeiro problema, na ordem do formulário, com a mensagem do banco', () => {
    expect(validarDadosPessoais(campos({ nomeCompleto: 'Ana' }), HOJE)).toBe('Informe o nome completo, com nome e sobrenome.');
    expect(validarDadosPessoais(campos({ nomeCompleto: '' }), HOJE)).toBe('Informe o nome completo, com nome e sobrenome.');
    expect(validarDadosPessoais(campos({ rga: '12345' }), HOJE)).toBe('O RGA tem 12 caracteres (letras e números).');
    expect(validarDadosPessoais(campos({ cpf: '529.982.247-26' }), HOJE)).toBe('CPF inválido. Confira os 11 números.');
    expect(validarDadosPessoais(campos({ nascimento: '31/02/2003' }), HOJE)).toBe('Informe uma data de nascimento válida (dd/mm/aaaa).');
    expect(validarDadosPessoais(campos({ genero: '' }), HOJE)).toBe('Escolha uma opção de gênero.');
    expect(validarDadosPessoais(campos({ nomeCompleto: 'Ana', rga: '1', cpf: '1' }), HOJE)).toBe('Informe o nome completo, com nome e sobrenome.');
  });
});

describe('prepararDados e camposDosDados', () => {
  it('entrega os dados normalizados', () => {
    expect(prepararDados(campos({ nomeCompleto: ' Ana  Ferraz ', rga: 'ab12.34 56789-0' }), HOJE)).toEqual({
      nomeCompleto: 'Ana Ferraz', rga: 'AB1234567890', cpf: '52998224725', nascimento: '2003-04-09', genero: 'feminino',
    });
  });

  it('devolve nulo quando algum campo não passa', () => {
    expect(prepararDados(campos({ cpf: '1' }), HOJE)).toBe(null);
  });

  it('refaz os campos do formulário a partir dos dados salvos', () => {
    expect(camposDosDados({ nome_completo: 'Ana Ferraz', rga: 'AB1234567890', cpf: '52998224725', nascimento: '2003-04-09', genero: 'outro' })).toEqual({
      nomeCompleto: 'Ana Ferraz', rga: 'AB1234567890', cpf: '529.982.247-25', nascimento: '09/04/2003', genero: 'outro',
    });
  });

  it('nomeia os gêneros', () => {
    expect(nomeDoGenero('nao_informar')).toBe('Prefiro não informar');
    expect(nomeDoGenero('feminino')).toBe('Feminino');
  });
});

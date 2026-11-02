// Regras do formulário de dados pessoais. Funções puras, sem acesso a dados.
// O banco confere tudo de novo (supabase/15_dados_pessoais.sql, salvar_meus_dados); aqui a pessoa só
// recebe o aviso antes de enviar e digita CPF e data sem pontuação: a máscara põe pontos, traço e barras.
import type { DadosPessoais, GeneroInformado } from '../../types/database';

export const TAMANHO_DO_RGA = 12;
export const ANO_MINIMO_DE_NASCIMENTO = 1930;

export const GENEROS: readonly { id: GeneroInformado; nome: string }[] = [
  { id: 'feminino', nome: 'Feminino' },
  { id: 'masculino', nome: 'Masculino' },
  { id: 'outro', nome: 'Outro' },
  { id: 'nao_informar', nome: 'Prefiro não informar' },
];

export function nomeDoGenero(genero: GeneroInformado): string {
  return GENEROS.find((g) => g.id === genero)?.nome ?? genero;
}

/** Só os dígitos do texto. */
export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/** Digitando 52998224725 aparece 529.982.247-25 (a cada tecla). */
export function mascararCpf(texto: string): string {
  const d = somenteDigitos(texto).slice(0, 11);
  const partes = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean);
  const final = d.slice(9);
  return partes.join('.') + (final ? `-${final}` : '');
}

/** Digitando 09042003 aparece 09/04/2003. */
export function mascararData(texto: string): string {
  const d = somenteDigitos(texto).slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
}

/** "52998224725" → "529.982.247-25"; qualquer outro texto volta como está. */
export function formatarCpf(cpf: string): string {
  return /^\d{11}$/.test(cpf) ? mascararCpf(cpf) : cpf;
}

/** Letras e números em maiúsculas, sem espaços nem pontuação. */
export function normalizarRga(texto: string): string {
  return texto.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function normalizarNome(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ');
}

/** Dígitos verificadores do CPF (o banco usa a mesma conta). */
export function cpfValido(texto: string): boolean {
  const cpf = somenteDigitos(texto);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (quantidade: number): number => {
    let soma = 0;
    for (let i = 0; i < quantidade; i++) soma += Number(cpf[i]) * (quantidade + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

/** "09/04/2003" → "2003-04-09"; nulo se não for uma data de calendário entre 1930 e hoje. */
export function dataParaISO(texto: string, hoje: string): string | null {
  const encontrado = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!encontrado) return null;
  const dia = Number(encontrado[1]);
  const mes = Number(encontrado[2]);
  const ano = Number(encontrado[3]);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
  if (ano < ANO_MINIMO_DE_NASCIMENTO) return null;
  const iso = `${encontrado[3]}-${encontrado[2]}-${encontrado[1]}`;
  return iso > hoje ? null : iso;
}

/** "2003-04-09" → "09/04/2003". */
export function dataDoISO(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Idade completa em anos na data `hoje` (AAAA-MM-DD). */
export function calcularIdade(nascimento: string, hoje: string): number {
  const [ano = 0, mes = 0, dia = 0] = nascimento.split('-').map(Number);
  const [anoHoje = 0, mesHoje = 0, diaHoje = 0] = hoje.split('-').map(Number);
  const fezAniversario = mesHoje > mes || (mesHoje === mes && diaHoje >= dia);
  return anoHoje - ano - (fezAniversario ? 0 : 1);
}

/** "09/04/2003 · 23 anos". */
export function descreverNascimento(nascimento: string, hoje: string): string {
  const idade = calcularIdade(nascimento, hoje);
  return `${dataDoISO(nascimento)} · ${idade} ${idade === 1 ? 'ano' : 'anos'}`;
}

export interface CamposDigitados {
  nomeCompleto: string;
  rga: string;
  cpf: string;
  nascimento: string;
  genero: string;
}

/** O que vai para o banco, já normalizado; só existe se os campos passaram na validação. */
export interface DadosParaSalvar {
  nomeCompleto: string;
  rga: string;
  cpf: string;
  nascimento: string;
  genero: GeneroInformado;
}

/** Problema nos campos, na ordem do formulário, ou null. As mensagens são as do banco. */
export function validarDadosPessoais(campos: CamposDigitados, hoje: string): string | null {
  const nome = normalizarNome(campos.nomeCompleto);
  if (nome.length < 5 || nome.length > 120 || !nome.includes(' ')) return 'Informe o nome completo, com nome e sobrenome.';
  if (normalizarRga(campos.rga).length !== TAMANHO_DO_RGA) return 'O RGA tem 12 caracteres (letras e números).';
  if (!cpfValido(campos.cpf)) return 'CPF inválido. Confira os 11 números.';
  if (dataParaISO(campos.nascimento, hoje) === null) return 'Informe uma data de nascimento válida (dd/mm/aaaa).';
  if (!GENEROS.some((g) => g.id === campos.genero)) return 'Escolha uma opção de gênero.';
  return null;
}

export function prepararDados(campos: CamposDigitados, hoje: string): DadosParaSalvar | null {
  if (validarDadosPessoais(campos, hoje) !== null) return null;
  const nascimento = dataParaISO(campos.nascimento, hoje);
  const genero = GENEROS.find((g) => g.id === campos.genero)?.id;
  if (nascimento === null || genero === undefined) return null;
  return {
    nomeCompleto: normalizarNome(campos.nomeCompleto),
    rga: normalizarRga(campos.rga),
    cpf: somenteDigitos(campos.cpf),
    nascimento,
    genero,
  };
}

/** Os campos do formulário a partir de dados já salvos (para editar). */
export function camposDosDados(dados: Pick<DadosPessoais, 'nome_completo' | 'rga' | 'cpf' | 'nascimento' | 'genero'>): CamposDigitados {
  return {
    nomeCompleto: dados.nome_completo,
    rga: dados.rga,
    cpf: formatarCpf(dados.cpf),
    nascimento: dataDoISO(dados.nascimento),
    genero: dados.genero,
  };
}

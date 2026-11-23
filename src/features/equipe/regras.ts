// Regras de apresentação do módulo Estrutura e equipe. Funções puras, sem acesso a dados.
// Permissões (quem cadastra, quem edita quem, quem define liderança) chegam prontas das visões do banco
// e só são lidas; o banco confere de novo cada cadastro.
import { tituloDoPapel } from '../../lib/perfil';
import type { AreaDaEstrutura, NucleoDaEstrutura, Papel, PessoaDaEquipe } from '../../types/database';

const porNome = (a: { nome: string }, b: { nome: string }): number => a.nome.localeCompare(b.nome, 'pt-BR');

/** "Ana Ferraz" → "AF"; nome único → só a inicial. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0];
  if (!primeira) return '?';
  const ultima = partes.length > 1 ? partes[partes.length - 1] ?? '' : '';
  return (primeira.charAt(0) + ultima.charAt(0)).toUpperCase();
}

/** Cargos que não têm núcleo: Presidente, Vice-Presidente e diretoria. */
export function precisaDeNucleo(papel: Papel): boolean {
  return papel === 'gerente' || papel === 'assessor' || papel === 'membro' || papel === 'trainee';
}

export function nucleosDaArea(nucleos: readonly NucleoDaEstrutura[], areaId: string): NucleoDaEstrutura[] {
  return nucleos.filter((n) => n.area_id === areaId).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Presidência primeiro; as demais por título. */
export function ordenarAreasParaCadastro<Area extends { id: string; titulo: string }>(areas: readonly Area[], idDaPresidencia: string | null): Area[] {
  return [...areas].sort((a, b) =>
    Number(b.id === idDaPresidencia) - Number(a.id === idDaPresidencia) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

/** "Gerência · Marketing": o cargo e o núcleo (ou, sem núcleo, a área). */
export function descreverCargoDaPessoa(
  pessoa: Pick<PessoaDaEquipe, 'papel' | 'area_id' | 'nucleo_id'>,
  areas: readonly Pick<AreaDaEstrutura, 'id' | 'titulo'>[],
  nucleos: readonly Pick<NucleoDaEstrutura, 'id' | 'nome'>[],
): string {
  const setor = nucleos.find((n) => n.id === pessoa.nucleo_id)?.nome ?? areas.find((a) => a.id === pessoa.area_id)?.titulo ?? pessoa.area_id;
  return `${tituloDoPapel(pessoa.papel)} · ${setor}`;
}

/** Lista do cadastro: por nome, com busca por nome ou e-mail (sem diferenciar maiúsculas nem acentos). */
export function filtrarEquipe(pessoas: readonly PessoaDaEquipe[], busca: string, incluirDesativadas: boolean): PessoaDaEquipe[] {
  const normalizar = (texto: string): string => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const termo = normalizar(busca.trim());
  return pessoas
    .filter((p) => (incluirDesativadas || p.ativo) && (!termo || normalizar(p.nome).includes(termo) || normalizar(p.email ?? '').includes(termo)))
    .sort(porNome);
}

/** Para a aba "Dados do time": pessoas ativas cujos dados quem consulta lê (indicador do banco), sem a própria, por nome. */
export function pessoasDoTime(pessoas: readonly PessoaDaEquipe[], meuId: string): PessoaDaEquipe[] {
  return pessoas.filter((p) => p.ativo && p.pode_ver_dados && p.id !== meuId).sort(porNome);
}

export interface CamposDoCadastro {
  email: string;
  nome: string;
  papel: Papel;
  area: string;
  nucleo: string;
}

const FORMATO_DE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Checagem antes de enviar, com as mesmas mensagens do banco (que confere de novo). `email` só vale no cadastro novo. */
export function validarCadastro(campos: CamposDoCadastro, nucleos: readonly NucleoDaEstrutura[], novo: boolean): string | null {
  if (novo && !FORMATO_DE_EMAIL.test(campos.email.trim())) return 'Informe um e-mail válido.';
  if (campos.nome.trim() === '') return 'Informe o nome.';
  if (!campos.area) return 'Escolha a área.';
  if (precisaDeNucleo(campos.papel) && !campos.nucleo) return 'Escolha o núcleo.';
  if (campos.nucleo && !nucleosDaArea(nucleos, campos.area).some((n) => n.id === campos.nucleo)) {
    return 'O núcleo escolhido não pertence a essa área.';
  }
  return null;
}

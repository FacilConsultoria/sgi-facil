// Textos derivados do perfil de quem está logado. Funções puras, sem acesso a dados.
import type { Perfil } from '../types/database';

const TITULO_DO_PAPEL: Record<Perfil['papel'], string> = {
  presidente: 'Presidência',
  vice: 'Vice-Presidência',
  diretor: 'Diretoria',
  gerente: 'Gerência',
  assessor: 'Assessoria',
  membro: 'Membro',
};

/** "Gerência", "Diretoria", "Membro"…: o papel por extenso, para listas de pessoas. */
export function tituloDoPapel(papel: Perfil['papel']): string {
  return TITULO_DO_PAPEL[papel];
}

/** Ex.: "Diretoria Comercial · cobre a Diretoria de Projetos", "Vice-Presidência · Diretoria Financeira" ou "Gerência · Marketing". */
export function descreverCargo(perfil: Perfil, tituloDaArea: (id: string) => string): string {
  if (perfil.papel === 'presidente') return 'Presidência';
  if (perfil.papel === 'vice') return ['Vice-Presidência', ...perfil.areas_que_conduz.map(tituloDaArea)].join(' · ');
  if (perfil.papel === 'diretor') {
    const [principal, ...cobertas] = perfil.areas_que_conduz.length ? perfil.areas_que_conduz : [perfil.area_id];
    const partes = [tituloDaArea(principal ?? perfil.area_id), ...cobertas.map((id) => `cobre a ${tituloDaArea(id)}`)];
    return partes.join(' · ');
  }
  if (perfil.papel === 'assessor') return perfil.nucleo_nome ?? 'Assessoria';
  return `${TITULO_DO_PAPEL[perfil.papel]} · ${perfil.nucleo_nome ?? perfil.area_titulo}`;
}

/** Frase curta sobre o que a pessoa enxerga no sistema, conforme a matriz de acesso. */
export function descreverEscopo(perfil: Perfil, tituloDaArea: (id: string) => string): string {
  switch (perfil.papel) {
    case 'presidente':
    case 'vice':
      return 'Acesso irrestrito a todas as diretorias, projetos e relatórios.';
    case 'diretor':
      return `Vê todos os núcleos de: ${perfil.areas_que_conduz.map(tituloDaArea).join(' e ') || perfil.area_titulo}.`;
    case 'assessor':
      return perfil.eh_presidencia
        ? 'Mesmo acesso da Presidência. Ajustar a própria pontuação e aprovar acessos por exceção dependem de aval da Presidente ou da Vice.'
        : 'Organiza agenda e atas das reuniões gerais e da Presidência.';
    case 'gerente':
      return `Vê as demandas e as pessoas de ${perfil.nucleo_nome ?? perfil.area_titulo}.`;
    case 'membro':
      return 'Vê as demandas em que consta como executor.';
  }
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

export * from './types';
export { generatePersonaData } from './generators';

import { strugglingSanjay } from './personas/struggling-sanjay';
import { studentSooJin } from './personas/student-soo-jin';
import { professionalPaul } from './personas/professional-paul';
import { execEvie } from './personas/exec-evie';
import type { PersonaConfig } from './types';

export const personas: PersonaConfig[] = [
  strugglingSanjay,
  studentSooJin,
  professionalPaul,
  execEvie,
];

export const personaMap: Record<string, PersonaConfig> = {
  'struggling-sanjay': strugglingSanjay,
  'student-soo-jin': studentSooJin,
  'professional-paul': professionalPaul,
  'exec-evie': execEvie,
};

export function getPersona(id: string): PersonaConfig | undefined {
  return personaMap[id];
}

export const defaultPersonaId = 'professional-paul';

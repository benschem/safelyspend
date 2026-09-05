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

export const personaMap = {
  'struggling-sanjay': strugglingSanjay,
  'student-soo-jin': studentSooJin,
  'professional-paul': professionalPaul,
  'exec-evie': execEvie,
} satisfies Record<string, PersonaConfig>;

/** The ids callers may pass around, so a typo or a renamed persona fails to compile. */
export type PersonaId = keyof typeof personaMap;

// Ids reaching getPersona come from storage and the URL, so the lookup takes any
// string. personaMap itself stays literal-typed so PersonaId can be derived from it.
const personaByAnyId: Record<string, PersonaConfig> = personaMap;

export function getPersona(id: string): PersonaConfig | undefined {
  return personaByAnyId[id];
}

export const defaultPersonaId: PersonaId = 'professional-paul';

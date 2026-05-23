// src/lib/moduleAccess.ts
// Module access rules for Project Sennzo (Prompt #21).
//
// Tier: full   = Enzo       — all 13 modules
// Tier: regular = Mark, Gabi, Claudia — modules 1,3,4,5,8,13
// Module 2 (Voice Interface) = voice only for regular tier — never full UI

export type DriverTier = 'full' | 'regular';

// All module IDs in the system
export const ALL_MODULES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;

// Modules available to regular-tier drivers
const REGULAR_MODULE_IDS = [1, 3, 4, 5, 8, 13] as const;

// Modules that are voice-interface-only for regular-tier (no full UI)
const VOICE_ONLY_MODULE_IDS = [2] as const;

export const MODULE_LABELS: Record<number, string> = {
  1:  'Telemetry Foundation',
  2:  'Voice Interface',
  3:  'Driver Profile',
  4:  'Multi-Driver',
  5:  'Tech & Equipment',
  6:  'Advanced Telemetry',
  7:  'Go-Karting Core',
  8:  'AI Video Analysis',
  9:  'Notifications',
  10: 'Super Admin',
  11: 'Dashboard Hosting',
  12: 'TIS Pipeline',
  13: 'Go-Karting (Module 13)',
};

/**
 * Returns the list of module IDs accessible to the given driver tier.
 */
export function getAccessibleModules(tier: DriverTier): number[] {
  return tier === 'full'
    ? [...ALL_MODULES]
    : [...REGULAR_MODULE_IDS];
}

/**
 * True if a module is accessible to the given tier at all.
 */
export function canAccessModule(moduleId: number, tier: DriverTier): boolean {
  return getAccessibleModules(tier).includes(moduleId);
}

/**
 * True if the module is voice-interface-only for this tier.
 * Regular-tier drivers hear Module 2 coaching audio but don't see the full Module 2 UI.
 */
export function isModuleVoiceOnly(moduleId: number, tier: DriverTier): boolean {
  return tier === 'regular' && (VOICE_ONLY_MODULE_IDS as readonly number[]).includes(moduleId);
}

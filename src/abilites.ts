export type ProficiencyCategory =
   | "skill"
   | "tool"
   | "weapon"
   | "armor"
   | "language" 

export const SKILLS = [
   "Acrobatics",
   "Survival"
] as const

export type Skill = typeof SKILLS[number];

export const ABILITIES = [
	"Strength",
	"Dexterity",
	"Constitution",
	"Wisdom",
	"Intelligence",
	"Dexterity",
] as const

export type Ability = typeof ABILITIES[number]

export type AbilityInfo = {
   proficient: boolean,
   value: number,
}

export type CharacterStats = Record<Ability, AbilityInfo>;

export function getAbilityModifier(stat: number): number {
	return Math.floor((stat - 10) / 2)
}

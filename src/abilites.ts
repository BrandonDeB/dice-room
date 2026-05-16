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
	"Wisdom",
	"Dexterity",
] as const

export type Ability = typeof ABILITIES[number]

export type AbilityInfo = {
   proficient: boolean,
   value: number,
}

export type CharacterStats = Record<Ability, AbilityInfo>;

export const Stats: Record<Ability, AbilityInfo> = {
	"Strength": {
		proficient: false,
		value: 12
	},
	"Wisdom": {
		proficient: true,
		value: 12
	},
	"Dexterity": {
		proficient: true,
		value: 12
	}
}

export type ProficiencyCategory =
   | "skill"
   | "tool"
   | "weapon"
   | "armor"
   | "language" 

export const SKILLS = [
	"Acrobatics",
	"Animal Handling",
	"Arcana",
	"Athletics",
	"Deception",
	"History",
	"Insight",
	"Intimidation",
	"Investigation",
	"Medicine",
	"Nature",
	"Perception",
	"Performance",
	"Persuasion",
	"Religion",
	"Sleight of Hand",
	"Stealth",
	"Survival"
] as const

export type Skill = typeof SKILLS[number];

export const ABILITIES = [
	"Strength",
	"Dexterity",
	"Constitution",
	"Wisdom",
	"Intelligence",
	"Charisma",
] as const

export type Ability = typeof ABILITIES[number]

export type AbilityInfo = {
   proficient: boolean,
   value: number,
}

export const SkillAbility: Record<Skill, Ability> = {
	"Acrobatics": "Dexterity",
	"Animal Handling": "Wisdom",
	"Arcana": "Intelligence",
	"Athletics": "Strength",
	"Deception": "Charisma",
	"History": "Intelligence",
	"Insight": "Wisdom",
	"Intimidation": "Charisma",
	"Investigation": "Intelligence",
	"Medicine": "Wisdom",
	"Nature": "Intelligence",
	"Perception": "Wisdom",
	"Performance": "Charisma",
	"Persuasion": "Charisma",
	"Religion": "Intelligence",
	"Sleight of Hand": "Dexterity",
	"Stealth": "Dexterity",
	"Survival": "Wisdom"
}

export function getAbilityModifier(stat: number): number {
	return Math.floor((stat - 10) / 2)
}

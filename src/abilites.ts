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

export const SKILLABILITY: Record<Skill, Ability> = {
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

/** The ability a name refers to ("Dexterity", "dex", "DEX"), or null if none. */
export function abilityNamed(entry: unknown): Ability | null {
	const text = String(entry ?? '').trim().toLowerCase();
	if (text === '') return null;
	return ABILITIES.find(ability =>
		ability.toLowerCase() === text || ability.substring(0, 3).toLowerCase() === text) ?? null;
}

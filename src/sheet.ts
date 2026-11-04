import { MarkdownPostProcessorContext } from "obsidian";
import { ABILITIES, Ability, SKILLABILITY, Skill, getAbilityModifier } from "./abilites";
import { describeLookupProblem, findUniqueBlock } from "./character";

/**
 * The character's numbers that several components need, read once from the
 * character's blocks, so each value is worked out in one place.
 */
export interface Sheet {
	/** Why there are no ability scores (no stats block, or two), or null if there are. */
	statsProblem: string | null;
	/** From the character block, if there is one. */
	level: number | null;
	/** From the level, else the stats block's proficiencyBonus, else +2. */
	proficiencyBonus: number;
	/** The modifier for an ability, or 0 without a stats block. */
	abilityModifier(ability: Ability): number;
	skillProficiency(skill: Skill): 'expertise' | 'proficient' | null;
	/** Ability modifier, plus the proficiency bonus (twice with expertise). */
	skillBonus(skill: Skill): number;
}

/** The proficiency bonus for a character level: +2 at 1 to 4, up to +6 at 17 to 20. */
export function proficiencyForLevel(level: number): number {
	return 2 + Math.floor((Math.max(1, level) - 1) / 4);
}

/** "1d20+3", "1d20-1", or "1d20" for a d20 roll with a bonus. */
export function d20(bonus: number): string {
	return bonus === 0 ? '1d20' : `1d20${bonus > 0 ? '+' : ''}${bonus}`;
}

/** Lower-case names from a YAML list, for case-insensitive matching. */
function lowerList(value: unknown): string[] {
	return Array.isArray(value) ? value.map(item => String(item).trim().toLowerCase()) : [];
}

export async function loadSheet(ctx: MarkdownPostProcessorContext): Promise<Sheet> {
	const [character, stats, skills] = await Promise.all([
		findUniqueBlock<{ level?: unknown }>(ctx, 'character'),
		findUniqueBlock<{ stats?: unknown; proficiencyBonus?: unknown }>(ctx, 'stats'),
		findUniqueBlock<{ proficiency?: unknown; expertise?: unknown }>(ctx, 'skills'),
	]);

	const statsData = stats.status === 'found' ? stats.match.data : {};
	const scores = Array.isArray(statsData.stats) ? statsData.stats : [];
	const level = character.status === 'found' && typeof character.match.data.level === 'number'
		? character.match.data.level : null;
	const fallbackBonus = typeof statsData.proficiencyBonus === 'number' ? statsData.proficiencyBonus : 2;
	const proficiencyBonus = level !== null ? proficiencyForLevel(level) : fallbackBonus;

	const skillsData = skills.status === 'found' ? skills.match.data : {};
	const proficient = lowerList(skillsData.proficiency);
	const expertise = lowerList(skillsData.expertise);

	const sheet: Sheet = {
		statsProblem: stats.status === 'found' ? null : describeLookupProblem('stats', stats),
		level,
		proficiencyBonus,
		abilityModifier(ability) {
			const score = scores[ABILITIES.indexOf(ability)];
			return typeof score === 'number' ? getAbilityModifier(score) : 0;
		},
		skillProficiency(skill) {
			const name = skill.toLowerCase();
			return expertise.includes(name) ? 'expertise' : proficient.includes(name) ? 'proficient' : null;
		},
		skillBonus(skill) {
			const level = sheet.skillProficiency(skill);
			const multiplier = level === 'expertise' ? 2 : level === 'proficient' ? 1 : 0;
			return sheet.abilityModifier(SKILLABILITY[skill]) + multiplier * proficiencyBonus;
		},
	};
	return sheet;
}

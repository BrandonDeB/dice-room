import { MarkdownPostProcessorContext } from "obsidian";
import { ABILITIES, Ability, getAbilityModifier } from "./abilites";
import { findUniqueBlock } from "./character";

/**
 * The character's numbers that several components need, read once from the
 * character's blocks, so each value is worked out in one place.
 */
export interface Sheet {
	/** The modifier for an ability, or 0 if the character has no stats block. */
	abilityModifier(ability: Ability): number;
}

export async function loadSheet(ctx: MarkdownPostProcessorContext): Promise<Sheet> {
	const stats = await findUniqueBlock<{ stats?: unknown }>(ctx, 'stats');
	const scores = stats.status === 'found' && Array.isArray(stats.match.data.stats) ? stats.match.data.stats : [];

	return {
		abilityModifier(ability) {
			const score = scores[ABILITIES.indexOf(ability)];
			return typeof score === 'number' ? getAbilityModifier(score) : 0;
		},
	};
}

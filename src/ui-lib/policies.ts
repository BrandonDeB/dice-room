import { BlockMatch, hasComponent } from "../character";
import { CharacterData } from "../character-data";
import { componentsOf } from "./component";
import { normalizeName } from "../modifiers";

/** A rule a card breaks, with the blocks involved so the user can fix it. */
export interface PolicyViolation {
	message: string;
	blocks: BlockMatch[];
}

/** Blocks holding a named thing, counting repeats within one block. */
function duplicates(holders: BlockMatch[], name: string, what: string): PolicyViolation | null {
	if (holders.length < 2) return null;
	const notes = [...new Set(holders.map(block => block.file.basename))].join(', ');
	return {
		message: `${holders.length} ${what} share the name "${name}" (in ${notes}). Rename or remove all but one.`,
		blocks: [...new Set(holders)],
	};
}

/**
 * The character-wide rules a card's components must keep: components marked unique
 * appear on one card only, and entries, modifiers and values each use a name once.
 */
export function checkPolicies(character: CharacterData, data: Record<string, unknown>): PolicyViolation[] {
	const violations: PolicyViolation[] = [];
	const { blocks } = character;

	for (const component of componentsOf(data)) {
		if (component.unique) {
			const holders = blocks.filter(block => hasComponent(block.data, component.key));
			if (holders.length > 1) {
				const notes = [...new Set(holders.map(block => block.file.basename))].join(', ');
				violations.push({
					message: `This character has ${holders.length} cards with ${component.label.toLowerCase()} (in ${notes}). Keep only one.`,
					blocks: holders,
				});
			}
		}

		const entryNames = component.entryNames;
		if (entryNames) {
			for (const own of entryNames(data[component.key])) {
				const holders = blocks.flatMap(block => hasComponent(block.data, component.key)
					? entryNames(block.data[component.key]).filter(name => normalizeName(name) === normalizeName(own)).map(() => block)
					: []);
				const violation = duplicates(holders, own, component.label.toLowerCase());
				if (violation) violations.push(violation);
			}
		}

		for (const modifier of component.modifiers?.(data[component.key]) ?? []) {
			const holders = character.modifiers
				.filter(other => normalizeName(other.name) === normalizeName(modifier.name))
				.map(other => blocks.find(block => block.file === other.file && block.location.lineStart === other.lineStart)!)
				.filter(Boolean);
			const violation = duplicates(holders, modifier.name, 'modifiers');
			if (violation) violations.push(violation);
		}
	}
	// A modifier's name can break the rule both as an entry and as a published modifier.
	return violations.filter((violation, i) => violations.findIndex(other => other.message === violation.message) === i);
}

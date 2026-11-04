import { MarkdownPostProcessorContext } from "obsidian";
import { BlockMatch, describeLookupProblem, findBlocksOfType, findUniqueBlock } from "../character";
import { BaseAttributes, ComponentMetadata, Policy } from "./base-component";
import { findModifiers, normalizeName } from "../modifiers";

/** Why a component may not be shown, with the blocks involved so the user can fix it. */
export interface PolicyViolation {
	message: string;
	blocks: BlockMatch[];
}

type PolicyCheck = (
	metadata: ComponentMetadata,
	ctx: MarkdownPostProcessorContext,
	attributes: BaseAttributes,
) => Promise<PolicyViolation | null>;

/** One check per policy. Adding a policy means adding an entry here. */
const POLICY_CHECKS: Record<Policy, PolicyCheck> = {
	/** At most one block of this type per character (or per note, without a character). */
	unique: async (metadata, ctx) => {
		const lookup = await findUniqueBlock(ctx, metadata.type);
		if (lookup.status !== 'duplicate') return null;
		return {
			message: describeLookupProblem(metadata.type, lookup),
			blocks: lookup.matches,
		};
	},

	/** No other modifier of the character may share a name with one this block publishes. */
	uniqueModifierNames: async (metadata, ctx, attributes) => {
		const own = (metadata.modifiers?.(attributes) ?? []).map(m => normalizeName(m.name));
		if (own.length === 0) return null;

		const published = await findModifiers(ctx);
		for (const name of own) {
			const sameName = published.filter(m => normalizeName(m.name) === name);
			if (sameName.length < 2) continue;
			const notes = [...new Set(sameName.map(m => m.file.basename))].join(', ');
			return {
				message: `${sameName.length} modifiers are named "${sameName[0].name}" (in ${notes}). Rename or remove all but one.`,
				blocks: sameName.map(m => ({ file: m.file, location: m.location, data: m.location.data })),
			};
		}
		return null;
	},

	/** No two entries of this type (in any of the character's blocks) share a name. */
	uniqueEntryNames: async (metadata, ctx, attributes) => {
		const entryNames = metadata.entryNames;
		if (!entryNames) return null;
		const own = entryNames(attributes);
		if (own.length === 0) return null;

		const blocks = await findBlocksOfType(ctx, metadata.type);
		for (const original of own) {
			const name = normalizeName(original);
			// Count every entry with this name, including repeats within one block.
			const holders = blocks.flatMap(block =>
				entryNames(block.data).filter(n => normalizeName(n) === name).map(() => block));
			if (holders.length < 2) continue;
			const label = (metadata.label ?? metadata.type).toLowerCase();
			return {
				message: `${holders.length} ${label} share the name "${original}". Rename or remove all but one.`,
				blocks: [...new Set(holders)],
			};
		}
		return null;
	},
};

export async function checkPolicies(
	metadata: ComponentMetadata,
	ctx: MarkdownPostProcessorContext,
	attributes: BaseAttributes,
): Promise<PolicyViolation[]> {
	const violations: PolicyViolation[] = [];
	for (const policy of metadata.policies ?? []) {
		const violation = await POLICY_CHECKS[policy](metadata, ctx, attributes);
		if (violation) violations.push(violation);
	}
	return violations;
}

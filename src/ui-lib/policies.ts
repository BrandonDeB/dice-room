import { MarkdownPostProcessorContext } from "obsidian";
import { BlockMatch, describeLookupProblem, findUniqueBlock } from "../character";
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

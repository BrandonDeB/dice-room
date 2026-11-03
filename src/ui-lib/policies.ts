import { MarkdownPostProcessorContext } from "obsidian";
import { BlockMatch, describeLookupProblem, findUniqueBlock } from "../character";
import { ComponentMetadata, Policy } from "./base-component";

/** Why a component may not be shown, with the blocks involved so the user can fix it. */
export interface PolicyViolation {
	message: string;
	blocks: BlockMatch[];
}

type PolicyCheck = (
	metadata: ComponentMetadata,
	ctx: MarkdownPostProcessorContext,
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
};

export async function checkPolicies(
	metadata: ComponentMetadata,
	ctx: MarkdownPostProcessorContext,
): Promise<PolicyViolation[]> {
	const violations: PolicyViolation[] = [];
	for (const policy of metadata.policies ?? []) {
		const violation = await POLICY_CHECKS[policy](metadata, ctx);
		if (violation) violations.push(violation);
	}
	return violations;
}

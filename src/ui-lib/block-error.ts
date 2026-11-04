import { createCallout } from './native';

/** A readable message from anything that was thrown. */
export function errorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (typeof err === 'string') return err;
	try {
		return JSON.stringify(err);
	} catch {
		return String(err);
	}
}

/**
 * Show why a dicelist block can't be displayed, in place of the block, so problems
 * are visible instead of the block silently disappearing. Drawn as an error callout.
 * Returns the callout's content element.
 */
export function renderBlockError(el: HTMLElement, title: string, detail?: string): HTMLElement {
	return createCallout(el, 'error', title, detail);
}

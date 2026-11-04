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
 * are visible instead of the block silently disappearing.
 */
export function renderBlockError(el: HTMLElement, title: string, detail?: string): HTMLElement {
	const box = el.createDiv({ cls: 'dicelist-error' });
	box.createEl('strong', { text: title });
	if (detail) box.createEl('p', { cls: 'dicelist-error-detail', text: detail });
	return box;
}

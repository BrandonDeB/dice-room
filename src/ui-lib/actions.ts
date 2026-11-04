import { Document } from "yaml";
import { YamlStep } from "./capabilities";

/**
 * Arguments passed to a published action. Kept loose on purpose so that
 * actions can be declared from YAML (e.g. an attack's `effects` list).
 */
export type ActionArgs = Record<string, unknown>;

/**
 * A published action. Receives the target block's current data and the
 * caller's arguments, and returns the YAML edits to make. Handlers must be
 * pure: no side effects, just validate and describe the change.
 * Throw an ActionError to reject the request with a user-facing message.
 */
export type ActionHandler<T = any> = (attributes: T, args: ActionArgs) => YamlStep[];

/** What an action did, or would do: the data before and after, and its arguments. */
export interface ActionResult<T = any> {
	before: T;
	after: T;
	args: ActionArgs;
	/** False for a preview (nothing saved yet), true once it has been saved. */
	applied: boolean;
}

/**
 * An action with an optional description. `describe` is used twice from one function:
 * as a preview on rolls before they're made ("Uses 1 of Arrows (2 left)"), and as the
 * announcement after ("Used 1 of Arrows. 1 left."). Check `applied` for the tense.
 */
export interface ActionDefinition<T = any> {
	run: ActionHandler<T>;
	describe?: (result: ActionResult<T>) => string;
}

/** Actions a component publishes: a plain handler, or a handler with a description. */
export type ActionMap<T = any> = Record<string, ActionHandler<T> | ActionDefinition<T>>;

/** Look up an action in either form, as a definition. */
export function getAction(map: ActionMap | undefined, name: string): ActionDefinition | undefined {
	const entry = map?.[name];
	if (!entry) return undefined;
	return typeof entry === 'function' ? { run: entry } : entry;
}

/** A request, usually declared in YAML, to run an action on another component. */
export interface Effect {
	/** The component to act on, such as `inventory`, or `event` to fire an event. */
	target: string;
	action: string;
	args?: ActionArgs;
	/** Only run when this holds, such as `$total >= 10` or `{{exhaustion}} > 0`. */
	if?: string;
}

/** An expected failure whose message is safe to show the user. */
export class ActionError extends Error {}

export function applyYamlSteps(doc: Document, steps: YamlStep[]) {
	for (const step of steps) {
		switch (step.op) {
			case 'set': doc.setIn(step.path, step.value); break;
			case 'delete': doc.deleteIn(step.path); break;
			case 'add': doc.addIn(step.path, step.value); break;
		}
	}
}

/**
 * Apply steps to a copy of plain data, the way applyYamlSteps edits a YAML document.
 * Lets previews work out the result of an action without touching the note.
 */
export function applyStepsToData<T>(data: T, steps: YamlStep[]): T {
	const root = JSON.parse(JSON.stringify(data ?? {}));
	const containerFor = (key: string | number) => (typeof key === 'number' ? [] : {});

	for (const step of steps) {
		if (step.path.length === 0) continue;
		let node = root;
		for (let i = 0; i < step.path.length - 1; i++) {
			const key = step.path[i];
			if (node[key] == null || typeof node[key] !== 'object') {
				if (step.op === 'delete') { node = null; break; }
				node[key] = containerFor(step.path[i + 1]);
			}
			node = node[key];
		}
		if (node == null) continue;
		const last = step.path[step.path.length - 1];

		switch (step.op) {
			case 'set':
				node[last] = step.value;
				break;
			case 'delete':
				if (Array.isArray(node) && typeof last === 'number') node.splice(last, 1);
				else delete node[last];
				break;
			case 'add':
				// Like the YAML library: append to a list, or set the value if nothing is there.
				if (Array.isArray(node[last])) node[last].push(step.value);
				else if (node[last] == null) node[last] = step.value;
				else throw new Error(`Cannot add to ${step.path.join('.')}: it is not a list`);
				break;
		}
	}
	return root;
}

export function requireString(args: ActionArgs, key: string): string {
	const value = args[key];
	if (typeof value !== 'string' || value.trim() === '') {
		throw new ActionError(`Missing "${key}"`);
	}
	return value.trim();
}

export function optionalPositiveInt(args: ActionArgs, key: string, fallback: number): number {
	const value = args[key];
	if (value === undefined || value === null) return fallback;
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
		throw new ActionError(`"${key}" must be a whole number of 1 or more`);
	}
	return value;
}

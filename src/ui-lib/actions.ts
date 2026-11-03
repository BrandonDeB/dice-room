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

export type ActionMap<T = any> = Record<string, ActionHandler<T>>;

/** A request, usually declared in YAML, to run an action on another component. */
export interface Effect {
	target: string;
	action: string;
	args?: ActionArgs;
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

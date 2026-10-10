export interface Rollable {
	onRoll(notation: string): void;
	setRollCallback: (cb: (notation: string) => void) => void;
}

export type YamlPath = (string | number)[];

export type YamlStep =
	| { op: 'set'; path: YamlPath; value: unknown }
	| { op: 'delete'; path: YamlPath }
	| { op: 'add'; path: YamlPath; value: unknown };

export interface Persistable {
	onPersist(steps: YamlStep[]): Promise<void>;
	setPersistCallback: (cb: (steps: YamlStep[]) => Promise<void>) => void;
}

declare module '@3d-dice/dice-box-threejs' {
	export class DiceBox {
		constructor(selector: string, options: Record<string, unknown>);
		initialize(): void;
		roll(notation: string): void;
		destroy(): void;
	}

	export class DiceNotation {
		constructor(notation: string, allowMultiple: boolean);
		stringify(full: boolean): string;
	}

	export const TEXTURELIST: Record<string, unknown>;
	export const MATERIALTYPES: Record<string, unknown>;
}

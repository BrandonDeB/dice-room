export interface Rollable {
	onRoll(notation: string): void;
	setRollCallback: (cb: (notation: string) => void) => void;
}

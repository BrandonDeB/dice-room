export interface BaseAttributes {
	type: string;
}

export interface BaseComponent {
	type: string;

	onRoll: (notation: string) => void;
	setRollCallback: (cb: (notation: string) => void) => void;

	render(): void;

}

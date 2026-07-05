export interface BaseAttributes {
	type: string;
}

export interface BaseComponent {
	type: string;
	attributes: BaseAttributes;

	onRoll: (notation: string) => void;
	setRollCallback: (cb: (notation: string) => void) => void;

	render(): void;

}

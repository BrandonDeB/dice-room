export type Dice = {
	sides: number;
}

export class DiceNotation {
	notation: string;
	
	constructor(notationString: string) {
		this.notation = this.parseNotationString(notationString);
	}

	// TODO - write out function that takes the user given
	// string, replaces modifiers, and returns new string
	public parseNotationString(notationString: string): string {
		return "1d20 + 5";
	}

}

export class DiceRoll {
	dice: Map<Dice, number>;
	modifiers: number[];
	notation: DiceNotation

	constructor(notation: DiceNotation) {
		this.dice = this.getDiceFromNotation(notation);
		this.modifiers = this.getModsFromNotation(notation);
		this.notation = notation;
	}

	// TODO - function should parse the notation string
	// and create the dice map
	getDiceFromNotation(notation: DiceNotation): Map<Dice, number> {
		const map = new Map<Dice, number>();
		map.set({sides: 20} as Dice, 1);
		return map
	}

	// TODO - function should collect all modifiers from
	// notation string and return as a list
	getModsFromNotation(notation: DiceNotation) {
		return [5]
	}

	// TODO - function that returns all the things
	// joined with a plus sign ()
	toString(): string {
		return this.notation.notation;
	}

}

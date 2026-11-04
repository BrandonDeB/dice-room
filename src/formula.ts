/*
 * Formulas: dice and arithmetic that can use the character's values by name.
 *
 *   1d20 + {{dex mod}} + {{proficiency}}
 *   2 + floor(({{level}} - 1) / 4)
 *   max({{str mod}}, {{dex mod}})
 *
 * A formula comes to some dice plus one whole number, which is what the dice library
 * can throw. Conditions, used by effects' `if`, compare numbers: `$total >= 10 and $natural > 1`.
 */

/** Dice to throw, such as ["1d20", "1d4"], plus a whole number. */
export interface DiceAmount {
	dice: string[];
	flat: number;
}

/** A mistake in a formula, or a name it can't find. The message is safe to show the user. */
export class FormulaError extends Error {}

/** Where a formula finds the numbers it names. */
export interface FormulaScope {
	/** The value for `{{name}}`. Throws FormulaError if there isn't one. */
	value(name: string): number;
	/** `$total` and `$natural`, after a roll. */
	variables?: Record<string, number | undefined>;
}

/** A scope with no values, for formulas that shouldn't name any. */
export const EMPTY_SCOPE: FormulaScope = {
	value: (name) => { throw new FormulaError(`No value named "${name}"`); },
};

type Token =
	| { kind: 'number'; value: number }
	| { kind: 'dice'; text: string }
	| { kind: 'ref'; name: string }
	| { kind: 'variable'; name: string }
	| { kind: 'word'; name: string }
	| { kind: 'op'; op: string };

const PATTERNS: [RegExp, (match: RegExpExecArray) => Token][] = [
	[/^\{\{\s*(.+?)\s*\}\}/, m => ({ kind: 'ref', name: m[1] })],
	[/^(\d*)d(\d+)(\{(?:adv|dis)\})?/i, m => ({ kind: 'dice', text: `${m[1] || '1'}d${m[2]}${(m[3] ?? '').toLowerCase()}` })],
	[/^\d+(\.\d+)?/, m => ({ kind: 'number', value: Number(m[0]) })],
	[/^\$([a-z]+)/i, m => ({ kind: 'variable', name: m[1].toLowerCase() })],
	[/^[a-z]+/i, m => ({ kind: 'word', name: m[0].toLowerCase() })],
	[/^(>=|<=|==|!=|[-+*/(),<>])/, m => ({ kind: 'op', op: m[0] })],
];

function tokenize(text: string): Token[] {
	const tokens: Token[] = [];
	let rest = text.trim();
	while (rest.length > 0) {
		const pattern = PATTERNS.find(([regex]) => regex.test(rest));
		if (!pattern) throw new FormulaError(`Can't read "${rest}" in "${text}"`);
		const match = pattern[0].exec(rest)!;
		tokens.push(pattern[1](match));
		rest = rest.slice(match[0].length).trimStart();
	}
	if (tokens.length === 0) throw new FormulaError('The formula is empty');
	return tokens;
}

/** A number, an amount with dice, or the result of a comparison. */
type Result = { dice: string[]; flat: number } | boolean;

const FUNCTIONS: Record<string, (args: number[]) => number> = {
	floor: ([x]) => Math.floor(x),
	ceil: ([x]) => Math.ceil(x),
	round: ([x]) => Math.round(x),
	abs: ([x]) => Math.abs(x),
	min: (args) => Math.min(...args),
	max: (args) => Math.max(...args),
};

/** Recursive descent over the tokens, working the result out as it goes. */
class Parser {
	private index = 0;

	constructor(private readonly tokens: Token[], private readonly scope: FormulaScope, private readonly text: string) {}

	parse(): Result {
		const result = this.or();
		if (this.index < this.tokens.length) throw new FormulaError(`Unexpected "${this.describe(this.tokens[this.index])}" in "${this.text}"`);
		return result;
	}

	private describe(token: Token): string {
		switch (token.kind) {
			case 'number': return String(token.value);
			case 'dice': return token.text;
			case 'ref': return `{{${token.name}}}`;
			case 'variable': return `$${token.name}`;
			case 'word': return token.name;
			case 'op': return token.op;
		}
	}

	private peekOp(...ops: string[]): string | null {
		const token = this.tokens[this.index];
		return token?.kind === 'op' && ops.includes(token.op) ? token.op : null;
	}

	private peekWord(word: string): boolean {
		const token = this.tokens[this.index];
		return token?.kind === 'word' && token.name === word;
	}

	private expect(op: string) {
		if (!this.peekOp(op)) throw new FormulaError(`Expected "${op}" in "${this.text}"`);
		this.index++;
	}

	private bool(result: Result): boolean {
		if (typeof result !== 'boolean') throw new FormulaError(`"and" and "or" join comparisons, like $total >= 10, in "${this.text}"`);
		return result;
	}

	private number(result: Result, what: string): number {
		if (typeof result === 'boolean') throw new FormulaError(`A comparison can't be used ${what} in "${this.text}"`);
		if (result.dice.length > 0) throw new FormulaError(`Dice can't be used ${what} in "${this.text}"`);
		return result.flat;
	}

	private or(): Result {
		let left = this.and();
		while (this.peekWord('or')) {
			this.index++;
			const right = this.and();
			left = this.bool(left) || this.bool(right);
		}
		return left;
	}

	private and(): Result {
		let left = this.comparison();
		while (this.peekWord('and')) {
			this.index++;
			const right = this.comparison();
			left = this.bool(left) && this.bool(right);
		}
		return left;
	}

	private comparison(): Result {
		const left = this.sum();
		const op = this.peekOp('>=', '<=', '==', '!=', '<', '>');
		if (!op) return left;
		this.index++;
		const a = this.number(left, 'in a comparison');
		const b = this.number(this.sum(), 'in a comparison');
		switch (op) {
			case '>=': return a >= b;
			case '<=': return a <= b;
			case '==': return a === b;
			case '!=': return a !== b;
			case '<': return a < b;
			default: return a > b;
		}
	}

	private sum(): Result {
		let left = this.product();
		let op: string | null;
		while ((op = this.peekOp('+', '-'))) {
			this.index++;
			const right = this.product();
			if (typeof left === 'boolean' || typeof right === 'boolean') throw new FormulaError(`A comparison can't be added to in "${this.text}"`);
			if (op === '-' && right.dice.length > 0) throw new FormulaError('Dice cannot be subtracted. Use a number like -2 instead.');
			left = { dice: [...left.dice, ...right.dice], flat: op === '+' ? left.flat + right.flat : left.flat - right.flat };
		}
		return left;
	}

	private product(): Result {
		let left = this.unary();
		let op: string | null;
		while ((op = this.peekOp('*', '/'))) {
			this.index++;
			const a = this.number(left, 'with * or /');
			const b = this.number(this.unary(), 'with * or /');
			if (op === '/' && b === 0) throw new FormulaError(`Division by zero in "${this.text}"`);
			left = { dice: [], flat: op === '*' ? a * b : a / b };
		}
		return left;
	}

	private unary(): Result {
		const op = this.peekOp('+', '-');
		if (op) {
			this.index++;
			const value = this.unary();
			if (op === '+') return value;
			return { dice: [], flat: -this.number(value, 'after a minus sign') };
		}
		return this.atom();
	}

	private atom(): Result {
		const token = this.tokens[this.index++];
		if (!token) throw new FormulaError(`"${this.text}" ends too soon`);
		switch (token.kind) {
			case 'number': return { dice: [], flat: token.value };
			case 'dice': return { dice: [token.text], flat: 0 };
			case 'ref': return { dice: [], flat: this.scope.value(token.name) };
			case 'variable': {
				const value = this.scope.variables?.[token.name];
				if (value === undefined) throw new FormulaError(`$${token.name} is only known after a roll`);
				return { dice: [], flat: value };
			}
			case 'word': {
				const fn = FUNCTIONS[token.name];
				if (!fn) throw new FormulaError(`Unknown word "${token.name}" in "${this.text}". Write values as {{${token.name}}}.`);
				this.expect('(');
				const args = [this.number(this.sum(), `inside ${token.name}()`)];
				while (this.peekOp(',')) {
					this.index++;
					args.push(this.number(this.sum(), `inside ${token.name}()`));
				}
				this.expect(')');
				return { dice: [], flat: fn(args) };
			}
			case 'op': {
				if (token.op !== '(') throw new FormulaError(`Unexpected "${token.op}" in "${this.text}"`);
				const inner = this.or();
				this.expect(')');
				return inner;
			}
		}
	}
}

function run(formula: unknown, scope: FormulaScope): Result {
	if (typeof formula === 'number') return { dice: [], flat: formula };
	if (typeof formula !== 'string') throw new FormulaError('Expected dice or a number, like 1d20+3');
	return new Parser(tokenize(formula), scope, formula).parse();
}

/** Work out a formula to dice plus a whole number. The number rounds down. */
export function evaluate(formula: unknown, scope: FormulaScope): DiceAmount {
	const result = run(formula, scope);
	if (typeof result === 'boolean') throw new FormulaError(`"${formula}" is a comparison, not an amount`);
	return { dice: result.dice, flat: Math.floor(result.flat) };
}

/** Work out a formula that must be a plain number, such as a value. */
export function evaluateNumber(formula: unknown, scope: FormulaScope): number {
	const amount = evaluate(formula, scope);
	if (amount.dice.length > 0) throw new FormulaError(`"${formula}" has dice, but needs to be a number`);
	return amount.flat;
}

/** Work out a condition, such as `$total >= 10`. */
export function evaluateCondition(formula: unknown, scope: FormulaScope): boolean {
	const result = run(formula, scope);
	if (typeof result !== 'boolean') throw new FormulaError(`"${formula}" should compare, like $total >= 10`);
	return result;
}

/** Whether a formula uses `$total` or `$natural`, so it can only be worked out after rolling. */
export function usesRollVariables(formula: unknown): boolean {
	return typeof formula === 'string' && /\$(total|natural)\b/i.test(formula);
}

/** "+2", "-1", or "" for zero. */
function signed(n: number): string {
	return n > 0 ? `+${n}` : n < 0 ? `${n}` : '';
}

/**
 * Notation the dice library throws: every die first, then one number, since it only
 * understands a number in last place ("1d20+1d4+5"). Advantage markers are kept.
 */
export function toNotation(amount: DiceAmount): string {
	if (amount.dice.length === 0) return String(amount.flat);
	return amount.dice.join('+') + signed(amount.flat);
}

/** "1d4+2", "+2", "-1" or "+0": how an amount added to a roll reads. */
export function amountText(amount: DiceAmount): string {
	return amount.dice.length > 0 ? amount.dice.join('+') + signed(amount.flat) : (signed(amount.flat) || '+0');
}

# Components and actions

This page is for contributors. It explains how cards are built from components and how
components talk to each other.

## How a block becomes a card

1. `src/main.ts` registers a processor for `dicelist` code blocks.
2. `src/codeblock.ts` parses the YAML, checks the character-wide rules in
   `src/ui-lib/policies.ts`, and creates a `Card` (`src/ui-lib/card.ts`).
3. The card draws its heading (`name`, the `type` tag, `picture`), its Markdown
   `description`, and then each component, in the order the YAML lists their keys.

There are no block types. `type` is only a label. Everything a card does comes from its
components.

## Writing a component

A component is a `CardComponent` (`src/ui-lib/component.ts`) registered under a YAML key in
`src/ui-lib/components/index.ts`. Its data is the value under that key, so a component
never sees the rest of the card.

```ts
export const notesComponent: CardComponent<string[]> = {
	key: 'notes',
	label: 'Notes',
	render(view) {
		for (const note of view.data ?? []) new Setting(view.el).setName(note);
	},
};
```

```ts
registerComponent(notesComponent);
```

Everything else is optional:

| Field | What it's for |
| --- | --- |
| `render(view)` | Draw rows into `view.el`. See [drawing](#drawing). |
| `actions` | Actions effects and `on` lists can run. See [actions](#actions-how-components-talk-to-each-other). |
| `unique` | Only one card per character may have it, so effects find it without a name. |
| `entryNames` | The names of the entries it holds. Effects pick the card by the `name` argument, and each name may be used once per character. |
| `modifiers` | Modifiers it publishes. See [modifiers](#modifiers). |
| `values` | Values it publishes for formulas. See [values](#values-and-formulas). |
| `onEvent`, `describeEvent` | How it reacts to events. See [events](#events). |

### Drawing

`render` gets a `ComponentView`:

1. `el`: the card's row list. Add `Setting` rows, or elements with the `dicelist-card-content` class.
2. `data`: the component's data, the value under its key.
3. `persist(steps)`: save YAML edits, with paths inside the component's data. The card
   puts its key in front, so `[0, 'used']` saves `consumables[0].used`.
4. `roll(roll)`: make a roll, with its effects and modifiers.
5. `refresh(update)`: `update` is called with the loaded character, and again whenever any
   of the character's notes change. Use it for anything worked out from other cards, such
   as totals. Update text in place, so keyboard focus isn't lost.
6. `layout`: `grid` when the card asks for tiles.
7. `owner`: the card, for registering DOM events and for link previews.

YAML edits are described as steps:

```ts
{ op: "set", path: [0, "quantity"], value: 5 }
{ op: "add", path: [], value: { name: "Rope", quantity: 1 } }
{ op: "delete", path: [2] }
```

## The character

`loadCharacter(ctx)` in `src/character-data.ts` reads every block in the character's notes
once and returns a `CharacterData`:

1. `modifiers`: every published modifier, with its value worked out.
2. `value(name)`: a value's total, plus the modifiers that added to it by category.
3. `evaluate(formula, variables)` and `condition(formula, variables)`: work out a
   [formula](../formulas.md) using the character's values.

Values and modifier values are worked out when first asked for and then kept, so they can
use each other. Going in a circle throws a `FormulaError` naming where.

## Values and formulas

`src/formula.ts` parses and works out formulas in one pass. A formula comes to a
`DiceAmount`: a list of dice and one whole number, which `toNotation` turns into what the
dice library throws. Values come from a `FormulaScope`, which `CharacterData.scope` provides.
Mistakes throw `FormulaError`, whose message is safe to show.

A component publishes values with its `values` function, returning `ValueDefinition`s: a
name, a formula, and categories that modifiers can add to.

## Modifiers

A component publishes modifiers with its `modifiers` function. Each `Modifier` has a name,
its raw `value` (a formula, or `advantage` or `disadvantage`), whether it's `active`, and
its categories. `CharacterData` works the values out.

`resolveRollModifiers(character, roll)` in `src/modifiers.ts` works out a roll's dice, picks
the modifiers it names plus those sharing one of its categories, and reports problems
instead of guessing: an unknown name, two modifiers with the same name, or a bad value.

## Rolls

A `Roll` (`src/roll.ts`) is an entry of a `rolls` list: a name, a `dice` formula, effects,
modifiers and categories. A component never throws dice or runs effects itself. It passes a
`Roll` to `view.roll`, and `performRoll` checks the Dice view is ready, checks every
effect, runs the effects that don't need the result, throws the dice, then runs those that
use `$total` or an `if` with `$total` or `$natural`. A roll without dice runs its effects
through `performEffects`.

## Actions: how components talk to each other

A component can publish **actions** that effects and `on` lists call. An action changes the
target component's data, wherever its card lives among the character's notes. The target
doesn't need to be open.

### Publishing an action

Each action is a pure function. It gets the component's current data and the caller's
arguments, and returns YAML steps with paths inside that data. Throw `ActionError` to
reject the request with a message for the user.

```ts
const healthActions: ActionMap<HealthFields> = {
	heal: {
		run: (fields, args) => {
			const amount = optionalPositiveInt(args, "amount", 1);
			if (fields.current >= fields.max) throw new ActionError("Already at full health");
			return [{ op: "set", path: ["current"], value: Math.min(fields.max, fields.current + amount) }];
		},
		describe: ({ after, args, applied }) => applied ? `Healed ${args.amount}.` : `Heals ${args.amount}`,
	},
};
```

Keep handlers free of side effects. They run as a dry run to preview what they'll do, and
again if the note changed, and a thrown error leaves the note untouched.

`describe` serves two places, with `applied` telling the tense: the preview under a roll
("Uses 1 of Arrows (2 left)"), and the announcement after ("Used 1 of Arrows. 1 left.").

Validate arguments with the helpers in `src/ui-lib/actions.ts`, such as `requireString` and
`optionalPositiveInt`, because arguments come from user-written YAML.

### How the target is found

`invokeAction` and `previewAction` in `src/character.ts`:

1. Look up the component by the effect's `target`, its key, and wrap its action with
   `blockAction` so it runs on the whole block, with the key added to each step's path.
2. Find the character's blocks that have that key. For components with `entryNames`, keep
   only the block holding the entry named by the `name` argument.
3. Require exactly one block.
4. Edit that note with `vault.process`, re-checking the block's position first.

Obsidian then re-renders the target block, so open views update automatically.

## Events

Character events, such as "long rest", let many cards react to one moment. Names are
compared ignoring case and extra spaces.

A component reacts on its own with `onEvent`: given its data and the event's name, it
returns YAML steps, or none. `describeEvent` gives the preview and the announcement.
Any card can also react with an `on` list, whose entries name an event, one of the card's
components as `target`, and an action. `checkSubscriptions` reports mistakes in an `on`
list, and the card shows them.

`reactToEvent` in `src/events.ts` works out one block's reaction on plain data: each
component's `onEvent`, then each matching `on` entry in order. `previewEvent` and
`fireEvent` both use it, so previews and firing agree. Firing writes each note once,
editing blocks from the bottom up so their positions stay valid.

Events are fired by the [events component](../components/events.md), by effects with
`target: event` and `action: emit`, and by switching on a concentration modifier.

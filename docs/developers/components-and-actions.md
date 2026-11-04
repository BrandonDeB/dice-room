# Components and actions

This page is for contributors. It explains how `dicelist` components are built
and how they talk to each other.

## How a block becomes a component

1. `src/main.ts` registers a processor for `dicelist` code blocks.
2. `src/codeblock.ts` parses the YAML and asks `ComponentFactory` for the class registered
   under its `type`.
3. The component is given its capabilities, such as rolling dice or saving edits, and is rendered.

All component classes are registered in `src/ui-lib/register.ts`.

## Writing a component

Extend `BaseComponent` with an attributes interface describing the block's YAML,
and give the class static `metadata`:

```ts
export interface HealthAttributes extends BaseAttributes {
	current: number;
	max: number;
}

export class HealthComponent extends BaseComponent<HealthAttributes> {
	static readonly metadata: ComponentMetadata = {
		type: "health",
		policies: ["unique"],
	};

	render() {
		this.containerEl.createEl("p", {
			text: `${this.attributes.current} / ${this.attributes.max}`,
		});
	}
}
```

Then register it in `src/ui-lib/register.ts`:

```ts
ComponentFactory.register(HealthComponent);
```

### Capabilities

Components opt into extra abilities by implementing an interface from
`src/ui-lib/capabilities.ts`. The code block wires them up automatically.

- `Rollable`: receives an `onRoll(roll)` callback. See [rolls](#rolls) below.
- `Persistable`: receives an `onPersist(steps)` callback that edits the component's own YAML.

YAML edits are described as steps, each with a path into the YAML:

```ts
{ op: "set", path: ["items", 0, "quantity"], value: 5 }
{ op: "add", path: ["items"], value: { name: "Rope", quantity: 1 } }
{ op: "delete", path: ["items", 2] }
```

### Policies

`"unique"` means the component should appear only once per character.

`"uniqueModifierNames"` means every modifier the block publishes must have a name no other
modifier of the character uses, whichever component type publishes it. The modifier
component uses it. Policy checks receive the block's YAML so they can see what it publishes.

Policies are checked in `src/ui-lib/policies.ts` before a block is displayed. A block that breaks
one shows an error, with links to the other blocks involved, instead of its contents.

## Rolls

A roll is defined by the `Roll` type in `src/roll.ts`: a `DiceNotation` plus optional effects.
`DiceNotation`, in `src/ui-lib/ui-types.ts`, fills in any `{{note.property}}` references.

```ts
interface Roll {
	notation: DiceNotation;
	effects?: Effect[];
}
```

A rollable component never throws dice or runs effects itself. It hands a `Roll` to `onRoll`,
and `performRoll` in `src/roll.ts` does the rest: check the Dice view is ready, run the effects
in order, then throw the dice. So every roll in every component supports effects for free.

If a roll comes from YAML, declare the field as `RollField` and normalize it with `parseRoll`.
That accepts both the short form, `hitRoll: 1d20+5`, and the long form with `dice` and `effects`.

```ts
export interface HealingPotionAttributes extends BaseAttributes {
	heal: RollField;
}

// in render():
const roll = parseRoll(this.attributes.heal);
if (roll) button.addEventListener("click", () => this.onRoll(roll));
```

Rolls a component generates itself, like a skill check, can pass just the notation:
`this.onRoll({ notation: new DiceNotation("1d20+3") })`.

Give `parseRoll` the roll's default [categories](../rolls.md#categories) as its second
argument, so category modifiers apply: `parseRoll(this.attributes.heal, ["healing"])`.
The YAML can add more.

## Actions: how components talk to each other

A component type can **publish actions** that roll effects call. An action changes
the target component's YAML, wherever it lives among the character's notes.
The target does not need to be open.

### Publishing an action

Add an `actions` map to the metadata. Each action is a pure function. It receives the target
block's current data and the caller's arguments, and returns YAML steps.
Throw `ActionError` to reject the request with a message for the user.

```ts
import { ActionError, ActionMap, optionalPositiveInt } from "./actions";

const healthActions: ActionMap<HealthAttributes> = {
	damage: (attrs, args) => {
		const amount = optionalPositiveInt(args, "amount", 1);
		return [{ op: "set", path: ["current"], value: Math.max(0, attrs.current - amount) }];
	},
	heal: (attrs, args) => {
		const amount = optionalPositiveInt(args, "amount", 1);
		if (attrs.current >= attrs.max) throw new ActionError("Already at full health");
		return [{ op: "set", path: ["current"], value: Math.min(attrs.max, attrs.current + amount) }];
	},
};

static readonly metadata: ComponentMetadata = {
	type: "health",
	policies: ["unique"],
	actions: healthActions,
};
```

Keep handlers free of side effects. They may be called again if the note changes,
and a thrown error leaves the note untouched. Rolls also run them as a dry run to preview
what they will do, so they must not change anything themselves.

### Describing an action

An action can be an object with `run` (the handler) and `describe`. One `describe`
function serves two places, so the wording lives in one spot:

1. **Preview**, before a roll is made: rolls show it under their total, such as
   "Uses 1 of Arrows (2 left)". `applied` is false.
2. **Announcement**, after the action is saved: shown in a notice, such as
   "Used 1 of Arrows. 1 left." `applied` is true.

It receives the target's data `before` and `after` the action (for a preview, `after` is
worked out without saving), and the action's `args`.

```ts
remove: {
	run: (attrs, args) => { /* return YAML steps, or throw ActionError */ },
	describe: ({ before, after, args, applied }) => {
		const left = itemIn(applied ? after : before, args.item)?.quantity ?? 0;
		return applied ? `Used 1 of ${args.item}. ${left} left.` : `Uses 1 of ${args.item} (${left} left)`;
	},
},
```

`previewAction` in `src/character.ts` runs the same target lookup and handler as
`invokeAction` without saving. `previewEffects` in `src/roll.ts` previews all of a roll's
effects; rolls display it, and `performRoll` checks it before running anything.

Validate arguments with the helpers in `src/ui-lib/actions.ts`, such as `requireString` and
`optionalPositiveInt`, because arguments often come from user-written YAML.

### Calling an action

Actions are called from a roll's effects:

```yaml
dice: 1d20+5
effects:
  - target: health
    action: damage
    args:
      amount: 5
```

Components do not call actions directly. Under the hood, `performRoll` calls `invokeAction`
in `src/character.ts`, which throws `ActionError` when the request is rejected, the target is
missing, or there is more than one target. `performRoll` shows that message in a notice
and stops the roll.

### Types with many blocks per character

Most action targets appear once per character. A type that can appear many times, like
`modifier`, sets `targetKey` in its metadata to the YAML field that identifies one block.
Callers then pass an argument of that name, and exactly one block must match:

```ts
static readonly metadata: ComponentMetadata = {
	type: "modifier",
	policies: [],
	targetKey: "name",
	actions: modifierActions,
};
```

```yaml
effects:
  - target: modifier
    action: "on"
    args:
      name: Bless
```

### Types holding named entries

A type whose blocks hold a list of named entries, like `consumable`, sets `entryNames` in
its metadata: a function returning the names in a block. Actions then take a `name`
argument and run on the one block holding that entry. Add the `"uniqueEntryNames"` policy
so a name used twice across the character shows an error.

```ts
static readonly metadata: ComponentMetadata = {
	type: "consumable",
	policies: ["uniqueEntryNames"],
	actions: consumableActions,
	entryNames: (attrs) => attrs.consumables.map(c => c.name),
};
```

### How the target is found

`invokeAction` in `src/character.ts`:

1. Looks up the handler from the target type's registered metadata.
2. Gets the character's notes from `getCharacterFiles`, which matches the `character` frontmatter property.
3. Uses Obsidian's metadata cache to jump to each note's code blocks. Notes with no code blocks
   are skipped without being read.
4. Requires exactly one block of the target type.
5. Edits that note with `vault.process`, re-checking the block's position first.
   If the note changed since it was found, it falls back to scanning the note's lines.

Obsidian then re-renders the target block, so open views update automatically.

## Modifiers: bonuses rolls can include

A component type can **publish modifiers** by adding a `modifiers` function to its metadata.
It receives the block's YAML data and returns a list, so one block can publish several.

```ts
import { Modifier, parseModifierValue } from "../modifiers";

const rageModifiers = (attrs: RageAttributes): Modifier[] => [{
	name: "Rage",
	value: parseModifierValue(attrs.bonus),
	active: attrs.raging === true,
	categories: ["damage"],
}];

static readonly metadata: ComponentMetadata = {
	type: "rage",
	policies: ["unique"],
	modifiers: rageModifiers,
};
```

Build every value with `parseModifierValue`. It returns either a parsed `ModifierValue`
(the dice to add, one summed flat number, and display text) or an `InvalidModifierValue`
holding what was written and why it was rejected. Check `value.valid` before using it.
Rolls refuse to use an invalid value and show the reason.

The built-in [modifier component](../components/modifier.md) in
`src/ui-lib/modifier-component.ts` is the simplest example, publishing one modifier per block.

For a component that publishes from a `publishes` list in its YAML, like weapons and spells,
`src/ui-lib/published-modifiers.ts` has the pieces:

1. `modifiersFromPublishes`: use it as the metadata `modifiers` function.
2. `renderPublishedSwitches(parent, attributes, persist)`: draws a switch for each entry and
   saves `active` back to that entry. The component needs the `Persistable` capability.
3. Add the `"uniqueModifierNames"` policy so a duplicated name shows an error.

### How a roll resolves its modifiers

`resolveRollModifiers` in `src/modifiers.ts`:

1. Reads every block among the character's notes in one pass, and asks each type with a
   `modifiers` function what it publishes.
2. Picks the modifiers the roll subscribes to by name, plus those sharing one of its categories.
3. Reports problems instead of guessing: an unknown subscribed name, two modifiers with the
   same name, or an invalid value.
4. Combines the dice with `combineNotation`, putting all dice first and summing flat numbers
   at the end, since the dice library only reads a flat number in last place.

`performRoll` calls it before running effects, and refuses the roll if there are problems.

### Showing live totals

To keep a displayed total current, resolve again when the character changes.
`BaseComponent.onCharacterChange(callback)` runs a callback, debounced, whenever any of
the character's notes changes in Obsidian's metadata cache, and stops when the component
unloads. `AttackComponent.refreshModifiers` in `src/ui-lib/attack-component.ts` is an example.

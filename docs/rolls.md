# Rolls, effects and modifiers

A **roll** is anything you click to throw dice, such as an attack's Hit button.
A roll can have **effects**: changes to other components that happen when you use it,
like spending an arrow or a spell slot.
A roll can also pick up **modifiers**: bonuses like Bless (+1d4) that are added to its dice
while they are switched on.

## Writing a roll

The short form is just the dice:

```yaml
hitRoll: 1d20+5
```

When the roll has effects, modifiers or extra categories, write it as an object with `dice`
and any of `effects`, `modifiers` and `categories`:

```yaml
hitRoll:
  dice: 1d20+5
  effects:
    - target: inventory
      action: remove
      args:
        item: Arrows
```

## Using note properties in dice

Dice can pull values from a note's frontmatter using double braces:

```yaml
hitRoll: 1d20+{{Characters/Aria.attackBonus}}
```

The part before the dot is the note's path from the vault root, without `.md`.
The part after the dot is the property name. If the note or property is missing,
the text is left as it is.

## Effects

Each effect has:

- `target`: the component type to act on, for example `inventory`.
- `action`: the name of an action that component publishes, for example `remove`.
  Each component's page lists its actions, such as [inventory actions](components/inventory.md#actions).
- `args`: the action's arguments.

The target must be found exactly once among the character's notes.
See [linking notes to a character](character-sheets.md#linking-notes-to-a-character).

### What happens when you click

1. If the Dice view is not open, or you have not joined a room, nothing happens
   and a notice tells you why. No effects run.
2. The effects run in order.
3. If an effect fails, for example "Not enough Arrows: have 0, need 1",
   a notice explains why and **the dice are not thrown**.
   Effects that already ran before the failure are not undone.
4. Otherwise, the dice are thrown.

## Modifiers

A roll includes a [modifier](components/modifier.md) while the modifier is switched on and
either:

1. the roll **subscribes** to it by name, or
2. the roll and the modifier share a **category**.

### Subscribing by name

List modifier names under `modifiers`. Names are not case sensitive.

```yaml
hitRoll:
  dice: 1d20+5
  modifiers: [Archery]
```

### Categories

Every roll has categories describing what kind of roll it is. A modifier with
`appliesTo: [attack]` is added to every roll in the `attack` category, without each roll
having to name it.

Components give their rolls these categories automatically:

| Component | Roll | Categories |
| --- | --- | --- |
| [Weapon](components/attacks.md) | `hitRoll` | `attack`, `weapon` |
| [Weapon](components/attacks.md) | `damageRoll` | `damage`, `weapon` |
| [Spell](components/attacks.md) | `hitRoll` | `attack`, `spell` |
| [Spell](components/attacks.md) | `damageRoll` | `damage`, `spell` |

A roll can add its own with `categories`, for example `categories: [ranged]`,
so a modifier with `appliesTo: ranged` only affects ranged attacks.

### How modifiers are added

All dice come first and flat numbers are added together at the end. With Bless (1d4) and
Archery (+2) on, `1d20+5` becomes `1d20+1d4+7`.

Rolls show their current total, and a line such as "Includes Bless (1d4), Archery (+2)".
Modifiers the roll would use but that are switched off are listed too, as "Off: Bless (1d4)".
Each name links to where the modifier is set: click to open it, or hover for a preview where
you can switch it on.
Switching a modifier on or off in any of the character's notes updates them.

### When a roll refuses

A roll will not be thrown, and shows why, if:

1. it subscribes to a modifier name that does not exist for the character,
2. two modifiers it would use share a name,
3. a modifier it would use has an invalid value, or
4. its dice use anything other than plain dice and numbers, such as `4d6kh3`,
   while a modifier applies.

Modifier problems are checked before effects run, so no ammo is spent on a refused roll.

## Which rolls support effects and modifiers

| Component | Rolls | Effects | Modifiers |
| --- | --- | --- | --- |
| [Weapon and spell](components/attacks.md) | `hitRoll`, `damageRoll` | Yes | Yes |
| [Stats](components/stats.md) | One per ability, generated | Not yet | Not yet |
| [Skills](components/skills.md) | One per skill, generated | Not yet | Not yet |

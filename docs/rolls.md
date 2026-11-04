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
  Each component's page lists its actions, such as [inventory actions](components/inventory.md#actions)
  or [consumable actions](components/consumable.md#actions).
- `args`: the action's arguments.

The target must be found exactly once among the character's notes.

### Using the roll's total

An effect argument written as `$total` is replaced with what the roll came to. Those
effects run after the dice are thrown, instead of before. For example, healing by the roll:

```yaml
damageRoll:
  dice: 2d4+2
  effects:
    - target: health
      action: heal
      args:
        amount: $total
```

Before you roll, the effect shows as "Heal by the roll's total".

### Firing events

An effect can fire a character event instead, such as a short or long rest, by using
`target: event` and `action: emit` with the event's `name`. Everything subscribed to that
event reacts, as when you take a [rest](components/rest.md): consumables refill if the
event is in their `refill` list.

```yaml
effects:
  - target: event
    action: emit
    args:
      name: long rest
```
See [linking notes to a character](character-sheets.md#linking-notes-to-a-character).

### Before you click

Each roll shows what its effects will do, such as "Uses 1 of Arrows (2 left)" or
"Uses 1 of 1st-level spell slots (3 of 4 left)". Each line links to the block it changes.
If an effect would fail, the roll shows why in red instead, such as
"Not enough Arrows: have 0, need 1", and its Roll button is hidden until there is enough again. These update whenever
any of the character's notes change.

### What happens when you click

1. If the Dice view is not open, or you have not joined a room, nothing happens
   and a notice tells you why. No effects run.
2. Every effect is checked first. If any would fail, a notice explains why,
   **nothing is spent, and the dice are not thrown**.
3. The effects run in order, and the dice are thrown.
4. A notice announces what the effects did, such as
   "Used 1 of Arrows. 1 left." and "Used 1 of 1st-level spell slots. 2 of 4 left."

## Advantage, disadvantage and critical hits

**Right-click** any d20 roll, or use the context menu key, to choose
**Roll with advantage** or **Roll with disadvantage**. The d20 is rolled twice and the
higher or lower one counts. This works on attack hit rolls, ability checks, saving throws,
skills and initiative.

A [modifier](components/modifier.md) can grant advantage or disadvantage too, by using
`advantage` or `disadvantage` as its value. For example, being poisoned:

```yaml
type: modifier
name: Poisoned
value: disadvantage
appliesTo: [attack, check]
```

Advantage and disadvantage cancel out: with both, the roll is normal.

After an attack roll, a natural 20 is announced as a critical hit, and a natural 1 as a
miss. **Right-click** the Damage roll and choose **Roll critical hit** to double every
damage die, including dice added by modifiers.

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
| [Stats](components/stats.md) | Ability check | `check`, `ability check`, the ability (`dexterity`) |
| [Stats](components/stats.md) | Saving throw | `save`, `saving throw`, the ability |
| [Skills](components/skills.md) | Skill check | `check`, `skill`, the skill (`stealth`), its ability |
| [Character](components/character.md) | Initiative | `initiative`, `check`, `dexterity` |
| [Hit points](components/health.md) | Death save | `death save`, `save` |
| [Hit points](components/health.md) | Hit die | `hit die` |

So a modifier with `appliesTo: save` reaches every saving throw, and `appliesTo: stealth`
reaches only Stealth checks.

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
| [Stats](components/stats.md) | A check and a save per ability | With `rolls` | Yes |
| [Skills](components/skills.md) | One per skill | With `rolls` | Yes |
| [Character](components/character.md) | Initiative | With `rolls` | Yes |

### Settings for generated rolls

Stats, skills and the character block make their rolls themselves. Give one of them extra
modifiers or effects with a `rolls` map, keyed by the roll's name (not case sensitive):
`Dexterity check` or `Dexterity save` on stats, a skill name like `Stealth` on skills, and
`Initiative` on the character block. Each entry takes the same `modifiers`, `effects` and
`categories` as an attack's roll.

```yaml
type: skills
proficiency: [Stealth]
rolls:
  Stealth:
    modifiers: [Cloak of Elvenkind]
```

The stats and skills cards list the active modifiers that apply to their rolls, such as
"Includes Bless (1d4)".

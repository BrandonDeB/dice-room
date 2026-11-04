# Attacks: weapons and spells

Weapons and spells share the same layout: a name, description, optional picture,
and two roll buttons, one **Hit** and one **Damage**.

## Weapon example

````markdown
```dicelist
type: weapon
name: Longbow
description: Two-handed, heavy.
range: 150/600 ft
hitRoll:
  dice: 1d20+5
  effects:
    - target: inventory
      action: remove
      args:
        item: Arrows
damageRoll: 1d8+3
picture: "[[longbow.png]]"
```
````

## Spell example

````markdown
```dicelist
type: spell
name: Fire Bolt
range: 120 ft
hitRoll: 1d20+6
damageRoll: 2d10
```
````

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `type` | Yes | `weapon` or `spell`. |
| `hitRoll` | No | The Hit [roll](../rolls.md). Left out, or `0`, hides the row, for spells with nothing to roll. |
| `damageRoll` | No | The Damage [roll](../rolls.md). Left out, or `0`, hides the row. |
| `name` | No | Heading shown at the top. |
| `description` | No | Text shown under the name. |
| `range` | No | Shown as "Range: ...". |
| `picture` | No | An image in your vault, as a wiki link or a path. |
| `use` | No | Effects run by a button without rolling, for spells like Goodberry. See [effects without a roll](#effects-without-a-roll). |
| `publishes` | No | Modifiers this attack or spell provides, each with an on/off switch on the card. See below. |
| `ability` | No | Works the rolls out from the character. See [rolls from the character](#rolls-from-the-character). |
| `proficient` | No | Whether proficiency is added to the hit roll. Defaults to yes. |
| `bonus` | No | A magic bonus, such as `1` for a +1 weapon. |
| `damage` | No | Damage dice, such as `1d8`, used with `ability`. |

Spells can also show these, each as its own row when present:

| Field | Description |
| --- | --- |
| `level` | Spell level. `0` shows as Cantrip. |
| `school` | School of magic, such as Evocation. |
| `castingTime` | For example `Action`, `Bonus action`, or `1 minute`. `ACTION` and `BONUS_ACTION` also work. |
| `components` | A list such as `[V, S, M]`. |
| `save` | The ability the target saves with, such as `dex`. Shows a Save DC instead of a Hit roll. |

## Rolls from the character

Instead of typing a to-hit bonus that goes stale when your stats or level change, give
the attack an `ability`. The plugin works the rolls out from the character's
[stats](stats.md) and [level](character.md), and updates them when those change.

| | Weapon | Spell |
| --- | --- | --- |
| `ability` | `str`, `dex`, or `finesse` for the better of the two | Your spellcasting ability, such as `wis` |
| Hit | d20 + ability modifier + proficiency + `bonus` | d20 + ability modifier + proficiency + `bonus` |
| Damage | `damage` dice + ability modifier + `bonus` | `damage` dice only |
| Save DC | | 8 + proficiency + ability modifier + `bonus`, when `save` is set |

````markdown
```dicelist
type: weapon
name: Rapier
ability: finesse
bonus: 1
damage: 1d8
```
````

````markdown
```dicelist
type: spell
name: Sacred Flame
level: 0
ability: wis
save: dex
damage: 1d8
```
````

Written `hitRoll` or `damageRoll` dice override the worked-out ones. To add effects or
modifiers to a worked-out roll, write the roll without `dice`:

```yaml
ability: dex
damage: 1d8
hitRoll:
  modifiers: [Archery]
  effects:
    - target: inventory
      action: remove
      args:
        item: Arrows
```

## Effects

Either roll can have effects, such as spending an arrow on the to-hit roll.
See [rolls and effects](../rolls.md).

### Effects without a roll

Some spells and items do something without any dice, like Goodberry. List their effects
under `use`, written the same way as a roll's effects. The card shows a row with a button:
**Cast** on spells, **Use** on weapons. Leave out `hitRoll` and `damageRoll` if there's
nothing to roll.

```yaml
type: spell
name: Goodberry
use:
  - target: inventory
    action: add
    args: { item: Goodberry, quantity: 10, description: Eat one to restore 1 hit point }
  - target: consumable
    action: use
    args: { name: 1st-level spell slots }
```

The row works like a roll's: it shows what will happen before you click, hides the button
when an effect would fail, checks every effect before running any, and announces the result.
The Dice view doesn't need to be open. Effects can fire events too. `$total` can't be used,
since nothing is rolled.

## Modifiers

Both rolls pick up active [modifiers](modifier.md), by name or through their
[categories](../rolls.md#categories): `attack` or `damage`, plus `weapon` or `spell`.

Each roll shows its total with modifiers included, and a line listing them.

## Publishing modifiers

A spell like Bless can provide the modifier itself. List it under `publishes`, using the same fields as a [modifier block](modifier.md#fields). The card shows a switch for each one. Turn it on when you cast the spell and off when it ends.

````markdown
```dicelist
type: spell
name: Bless
description: Concentration, up to 1 minute
publishes:
  - name: Bless
    value: 1d4
    active: false
    appliesTo: [attack, save]
```
````

Add `concentration: true` to a published modifier for a concentration spell: switching it
on ends any other [concentration](modifier.md#concentration).

Published names count toward the same rule as modifier blocks: each name only once per character. A card that publishes a name used elsewhere shows an error instead of its contents.
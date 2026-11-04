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
| `publishes` | No | Modifiers this attack or spell provides, each with an on/off switch on the card. See below. |

Spells can also show these, each as its own row when present:

| Field | Description |
| --- | --- |
| `level` | Spell level. `0` shows as Cantrip. |
| `school` | School of magic, such as Evocation. |
| `castingTime` | For example `Action`, `Bonus action`, or `1 minute`. `ACTION` and `BONUS_ACTION` also work. |
| `components` | A list such as `[V, S, M]`. |

## Effects

Either roll can have effects, such as spending an arrow on the to-hit roll.
See [rolls and effects](../rolls.md).

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

Published names count toward the same rule as modifier blocks: each name only once per character. A card that publishes a name used elsewhere shows an error instead of its contents.
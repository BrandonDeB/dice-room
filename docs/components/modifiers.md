# Modifiers

Named bonuses with on/off switches, such as Bless (+1d4 to attacks and saves), a fighting
style (+2 to ranged attacks), or a condition like Poisoned (disadvantage on attacks and
checks). While one is on, it's added to every roll that uses it.
See [rolls and modifiers](../rolls.md#modifiers) for how rolls pick modifiers up.

Put a modifier on the card it comes from, so its switch sits there: Bless on the Bless
spell's card, Rage on the Rage feature's card, conditions on a Conditions card.

A character can have any number of modifiers, but each name only once, ignoring case.
If two share a name, each card shows an error with links to the others. This includes
modifiers given by [items](inventory.md#switches-and-modifiers).

## Example

````markdown
```dicelist
type: spell
name: Bless
description: Concentration, up to 1 minute.
modifiers:
  - name: Bless
    value: 1d4
    appliesTo: [attack, save]
    concentration: true
```
````

Conditions are modifiers you write for your game. For D&D:

````markdown
```dicelist
name: Conditions
modifiers:
  - { name: Poisoned, value: disadvantage, appliesTo: [attack, check] }
  - { name: Prone, value: disadvantage, appliesTo: [attack] }
  - { name: Invisible, value: advantage, appliesTo: [attack] }
  - { name: Exhaustion, value: "-2 * {{exhaustion}}", appliesTo: [attack, check, save], active: true }
```
````

The Exhaustion modifier uses a [value](values.md) you count up and down, so it takes 2 per
level and isn't listed on rolls at level 0.

## Fields

`modifiers` is a list. Each modifier has:

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | The name rolls can include it by. Not case sensitive. Must be unique for the character. |
| `value` | Yes | Dice like `1d4`, a number like `2` or `-1`, a [formula](../formulas.md) like `-2 * {{exhaustion}}`, or `advantage` or `disadvantage`. Dice can't be subtracted. |
| `active` | No | Whether it's switched on. Defaults to off. The switch saves this for you. |
| `appliesTo` | No | [Categories](../rolls.md#categories) of rolls and [values](values.md) it applies to automatically, such as `attack`, `damage` or `armor class`. Without it, the modifier only applies to rolls that name it. |
| `description` | No | Shown under the name. |
| `concentration` | No | `true` for a spell you concentrate on. See [concentration](#concentration). |

Each row shows the value worked out, such as `-4` for exhaustion at level 2.

## Concentration

You can only concentrate on one spell at a time. Mark a modifier with `concentration: true`,
and switching it on switches off every other concentration modifier the character has.
A notice says which ended, such as "Ended concentration on Bless."

This applies to the switches on cards. Switching a modifier on from a roll effect or an
event subscription doesn't end other concentration.

## Actions

[Effects](../rolls.md#effects) and [event subscriptions](../events.md) can switch a
modifier. Every action needs a `name` argument to choose which.

| Action | What it does |
| --- | --- |
| `on` | Switches the modifier on. |
| `off` | Switches the modifier off. |
| `toggle` | Switches it to the opposite state. |

For example, a trap that poisons you, and a potion that cures it:

```yaml
effects:
  - target: modifiers
    action: "on"
    args: { name: Poisoned }
```

```yaml
effects:
  - target: modifiers
    action: "off"
    args: { name: Poisoned }
```

Quoting `"on"` and `"off"` is a good habit: some YAML tools read them as true and false.

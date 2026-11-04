# Modifier

A named bonus with an on/off switch, such as a fighting style (+2 to ranged attacks) or Rage (+2 damage). While it is on, it is added to every roll that uses it.
See [rolls and modifiers](../rolls.md#modifiers) for how rolls pick modifiers up.

Use a modifier block for bonuses that stand on their own. When a bonus comes from a spell or attack, such as Bless, publish it from that card instead, so its switch sits with the spell. See [publishing modifiers](attacks.md#publishing-modifiers).

A character can have any number of modifiers, but each name must be used only once, ignoring case. If two modifiers share a name, each one shows an error with links to the others instead of its switch, until only one remains. This includes modifiers published by other kinds of components.

## Example

````markdown
```dicelist
type: modifier
name: Bless
value: 1d4
active: false
appliesTo: [attack, save]
description: Concentration, up to 1 minute
```
````

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `type` | Yes | Must be `modifier`. |
| `name` | Yes | The name rolls subscribe to. Not case sensitive. Must be unique for the character. |
| `value` | Yes | Dice like `1d4`, a number like `+2` or `-1`, both like `1d4+1`, or `advantage` or `disadvantage`. Dice cannot be subtracted. Can use [note properties](../rolls.md#using-note-properties-in-dice), like `+{{Characters/Aria.proficiency}}`. |
| `active` | No | Whether it is switched on. Defaults to off. The switch saves this for you. |
| `appliesTo` | No | Roll [categories](../rolls.md#categories) it applies to automatically, such as `attack` or `damage`. `armor class` raises the [character](character.md) block's armor class. Without it, the modifier only applies to rolls that name it. |
| `description` | No | Shown under the name. |

## Actions

Roll [effects](../rolls.md#effects) can switch a modifier block. Every action needs a `name`
argument to choose which modifier. Usually a switch is clearer, since an effect only runs
when a roll is made and nothing turns the modifier back off.

| Action | What it does |
| --- | --- |
| `on` | Switches the modifier on. |
| `off` | Switches the modifier off. |
| `toggle` | Switches it to the opposite state. |

For example, a roll that switches a Rage modifier on:

```yaml
hitRoll:
  dice: 1d20+5
  effects:
    - target: modifier
      action: "on"
      args:
        name: Rage
```

Quoting `"on"` and `"off"` is a good habit: some YAML tools read them as true and false.
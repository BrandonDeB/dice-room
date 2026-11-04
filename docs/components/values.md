# Values

Named numbers that [formulas](../formulas.md) anywhere on the character can use, written
as `{{name}}`: ability scores, level, proficiency, armor class, or anything your game uses.
A value can be a number or a formula using other values, and modifiers can add to it.

## Example

````markdown
```dicelist
name: Aria
type: character
values:
  - name: level
    value: 5
  - name: proficiency
    value: "2 + floor(({{level}} - 1) / 4)"
  - name: Armor class
    value: 13 + {{dex mod}}
    categories: [armor class]
  - name: Exhaustion
    value: 0
    min: 0
    max: 6
```
````

## Fields

Each value has:

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | What formulas call it. Not case sensitive. Must be unique for the character. |
| `value` | Yes | A number, or a [formula](../formulas.md) that comes to a number, without dice. |
| `categories` | No | Active [modifiers](modifiers.md) with any of these in their `appliesTo` add their numbers to it, such as a shield adding 2 to armor class. Only plain numbers add; dice and advantage are for rolls. |
| `description` | No | Shown under the name. |
| `min`, `max` | No | On a plain number, adds minus and plus buttons, and keeps it within these. Good for things you count, like exhaustion or death saves. |
| `hidden` | No | `true` to leave it off the card, for values that only feed formulas, like ability modifiers. Formulas still use it. |

The card shows each value worked out, and which modifiers added to it, such as
"Includes: Shield (+2)". A value with a mistake, or one that names a value the character
doesn't have, shows why.

With `layout: grid` on the card, values show as tiles, like ability scores on a sheet.
Values you count with buttons still show as rows.

## Actions

[Effects](../rolls.md#effects) and [event subscriptions](../events.md) can change a value
that's a plain number. Each action needs the value's `name`, and stays within `min` and `max`.

| Action | Arguments | What it does |
| --- | --- | --- |
| `increase` | `name`, `amount` (default 1) | Adds to it. |
| `decrease` | `name`, `amount` (default 1) | Takes from it. |
| `set` | `name`, `value` | Sets it to a number, such as 0 for death saves after a rest. |

A value worked out from a formula can't be changed this way.

# Feature

A class feature, racial trait or feat: its description, where it comes from, and a
**Use** button if a [consumable](consumable.md) tracks how many times you can use it.

## Example

````markdown
```dicelist
type: feature
name: Favored Foe
source: Ranger 1
description: |
  When you hit a creature with an attack, you can mark it as your favored enemy.
  The first time each turn you hit it, it takes an extra **1d4** damage.
uses: Favored Foe
```
````

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `type` | Yes | Must be `feature`. |
| `name` | No | The card's title. |
| `source` | No | Where it comes from, shown under the title, such as `Ranger 1` or `Wood Elf`. |
| `description` | No | Markdown, rendered like the rest of your note: links and formatting work. |
| `uses` | No | The name of a consumable that tracks its uses. |

## Uses

With `uses`, the card shows how many are left, such as
"Uses 1 of Favored Foe (2 of 3 left)", and the **Use** button spends one. When none are
left, the button hides and the card says why. Refill the consumable with a [rest](rest.md).

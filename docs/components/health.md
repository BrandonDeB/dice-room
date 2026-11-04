# Health

Tracks hit points and temporary hit points.

**One per character.**

## Example

````markdown
```dicelist
name: Aria
health:
  max: 38
  current: 30
  temp: 0
```
````

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `max` | Yes | Maximum hit points. |
| `current` | No | Current hit points. Defaults to the max. |
| `temp` | No | Temporary hit points. Defaults to 0. |

The card saves `current` and `temp` for you.

## Using the card

Type an amount, then choose **Damage**, **Heal** or **Temp**. Temporary hit points absorb
damage first, and don't stack: the higher amount is kept.

Hit dice, death saves and resting aren't built in, since they differ between games. Build
them from other components: the [example sheet](../example-sheet.md) has hit dice as a
[consumable](consumables.md) with a roll that heals, death saves as a roll with
[conditional effects](../rolls.md#conditional-effects), and a long rest that restores
hit points through an [`on` list](../events.md#subscribing-a-card).

## Actions

[Effects](../rolls.md#effects) and [event subscriptions](../events.md) can use these.
`amount` can be `$total` to use what the roll came to.

| Action | Arguments | What it does |
| --- | --- | --- |
| `damage` | `amount` | Takes damage, temporary hit points first. |
| `heal` | `amount` | Heals, up to the max. |
| `temp` | `amount` | Gains temporary hit points, keeping the higher amount. |
| `restore` | none | Back to full, with no temporary hit points. |

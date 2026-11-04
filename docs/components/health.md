# Hit points

Tracks a character's hit points, temporary hit points, hit dice and death saving throws.

**One per character.**

## Example

````markdown
```dicelist
type: health
max: 38
current: 30
temp: 0
hitDice:
  die: d10
  max: 5
  used: 1
```
````

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `type` | Yes | Must be `health`. |
| `max` | Yes | Maximum hit points. |
| `current` | No | Current hit points. Defaults to the max. |
| `temp` | No | Temporary hit points. Defaults to 0. |
| `hitDice` | No | Hit dice: the `die` (like `d10`), how many in total (`max`), and how many are `used`. |

The card saves `current`, `temp`, `hitDice.used` and death saves for you.

## Using the card

1. Type an amount, then choose **Damage**, **Heal** or **Temp**.
   Temporary hit points absorb damage first, and don't stack: the higher amount is kept.
2. **Hit dice**: Roll spends a hit die and heals by what you roll, the die plus your
   Constitution modifier from the [stats](stats.md) block.
3. At 0 hit points, a **Death saves** row appears. Roll records the result: 10 or more is
   a success, a 1 counts as two failures, and a 20 brings you back with 1 hit point.
   Taking damage at 0 hit points counts as a failure. Healing clears death saves.

A [long rest](rest.md) restores all hit points, regains half your hit dice (at least one),
and clears temporary hit points and death saves.

## Actions

Roll [effects](../rolls.md#effects) and [event subscriptions](../events.md) can use these.
`amount` can be `$total` to use what the roll came to: see [using the roll's total](../rolls.md#using-the-rolls-total).

| Action | Arguments | What it does |
| --- | --- | --- |
| `damage` | `amount` | Takes damage, temporary hit points first. |
| `heal` | `amount` | Heals, up to the max. |
| `temp` | `amount` | Gains temporary hit points, keeping the higher amount. |
| `spendHitDie` | none | Spends a hit die. Fails if none are left. |
| `deathSave` | `roll` | Records a death saving throw from its result. |

For example, a healing potion:

```yaml
type: weapon
name: Potion of Healing
hitRoll: 0
damageRoll:
  dice: 2d4+2
  effects:
    - target: health
      action: heal
      args:
        amount: $total
```

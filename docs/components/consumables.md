# Consumables

Limited resources that are used up and later refilled: spell slots, hit dice,
transformations like Wild Shape, or any feature you can only use a few times between rests.
A card can hold several.

Each consumable is a row showing how many are left, with buttons to use one or restore one.
With more than one, a **Refill all** row at the bottom restores everything on the card.

## Example

````markdown
```dicelist
name: Spell slots
consumables:
  - name: 1st-level spell slots
    max: 4
    refill: long rest
  - name: Wild Shape
    max: 2
    used: 1
    description: Turn into a beast you have seen
    refill: short rest
```
````

## Fields

`consumables` is a list. Each consumable has:

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | What it is called. Must be unique for the character, ignoring case. |
| `max` | Yes | How many there are when full. Whole number, 1 or more. |
| `used` | No | How many have been used since the last refill. Defaults to 0. The buttons save this for you. |
| `description` | No | Shown under the name. |
| `refill` | No | The [event](../events.md) or events that refill it, such as `long rest` or `[short rest, long rest]`. |
| `gain` | No | Events with how many come back, such as `{ dawn: 2 }`. Never goes above the max. |
| `lose` | No | Events with how many are lost, such as `{ long rest: 1 }`. Never goes below zero. |

If one event does several of these, they apply in order: refill, then gain, then lose.
A card can also subscribe with an [`on` list](../events.md#subscribing-a-card).

A character can have consumables on several cards and notes, but each name only once.
If two share a name, each card shows an error with links to the others.

## Actions

Roll [effects](../rolls.md#effects) can use these. Every action needs a `name` argument
to choose the consumable.

### use

Spends some. Fails if there are not enough left, for example
"Not enough 1st-level spell slots: 0 of 4 left, need 1".

| Argument | Required | Description |
| --- | --- | --- |
| `name` | Yes | Which consumable. |
| `amount` | No | How many to spend. Whole number, 1 or more. Defaults to 1. |

### restore

Gets some back, up to the max.

| Argument | Required | Description |
| --- | --- | --- |
| `name` | Yes | Which consumable. |
| `amount` | No | How many to restore. Defaults to 1. |

### refill

Restores it to full.

| Argument | Required | Description |
| --- | --- | --- |
| `name` | Yes | Which consumable. |

For example, a spell that spends a slot when you roll its damage:

```yaml
rolls:
  - name: Damage
    dice: 3d6
    effects:
      - target: consumables
        action: use
        args:
          name: 1st-level spell slots
```

A feature with limited uses is a roll without dice that spends one:

```yaml
name: Favored Foe
rolls:
  - name: Use
    effects:
      - target: consumables
        action: use
        args: { name: Favored Foe }
```

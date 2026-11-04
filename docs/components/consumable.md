# Consumables

Limited resources that are used up and later refilled: spell slots, transformations like
Wild Shape, or any feature you can only use a few times between rests. One block can hold
several.

Each consumable is a row showing how many are left, with buttons to use one or restore one.
A **Refill all** row at the bottom restores everything in the block, for example after a rest.

## Example

````markdown
```dicelist
type: consumable
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

| Field | Required | Description |
| --- | --- | --- |
| `type` | Yes | Must be `consumable`. |
| `consumables` | Yes | The list of consumables. |

Each consumable has:

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | What it is called. Must be unique for the character, ignoring case. |
| `max` | Yes | How many there are when full. Whole number, 1 or more. |
| `used` | No | How many have been used since the last refill. Defaults to 0. The buttons save this for you. |
| `description` | No | Shown under the name. |
| `refill` | No | When it comes back, shown as "Refills on long rest". For your reference only. |

A character can have consumables in several blocks and notes, but each name only once.
If two share a name, each block shows an error with links to the others.

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
damageRoll:
  dice: 3d6
  effects:
    - target: consumable
      action: use
      args:
        name: 1st-level spell slots
```

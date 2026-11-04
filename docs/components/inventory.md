# Inventory

Lists a character's items with editable quantities. Items can have switches, like
Equipped, and give [modifiers](modifiers.md) while they're on.

**One per character.** Any [roll's effects](../rolls.md#effects)
can add and remove items from it.

## Example

````markdown
```dicelist
name: Backpack
inventory:
  - name: Arrows
    quantity: 20
    description: Standard ammunition for bows
  - name: Healing Potion
    quantity: 2
```
````

## Fields

`inventory` is a list of items. Each has a `name`, a `quantity`, and an optional
`description` shown under its name. Write `inventory: []` for an empty one that effects
can add to.

Item names should be unique. If two items share a name, you will see a warning.

## Editing quantities

Type a new number in an item's box, then press Enter or click away.
The change is saved into the note's YAML.

## Switches and modifiers

Items can give [modifiers](modifiers.md), such as a +1 to armor class and saving throws.
Give an item `switches`, such as Equipped or Attuned, and its modifiers apply only while
every switch is on. Each switch shows on the item's row. An item with modifiers and no
switches always gives them.

| Field | Description |
| --- | --- |
| `switches` | Names with on or off, such as `{ Equipped: true, Attuned: false }`. The card saves these for you. |
| `modifiers` | The modifiers it gives, written like a [`modifiers`](modifiers.md) list. |

```yaml
inventory:
  - name: Cloak of Protection
    quantity: 1
    switches: { Equipped: true, Attuned: true }
    modifiers:
      - name: Cloak of Protection
        value: 1
        appliesTo: [armor class, save]
```

A [value](values.md) with the `armor class` category picks up the +1 while the cloak is
equipped and attuned.

## Actions

[Effects](../rolls.md#effects) and [event subscriptions](../events.md) can run these.
Item names are matched without regard to case.

### add

Adds to an item's quantity. If the item does not exist, it is created, with the
description if one is given. An existing item's description is not changed.

| Argument | Required | Description |
| --- | --- | --- |
| `item` | Yes | Item name. |
| `quantity` | No | How many to add. Whole number, 1 or more. Defaults to 1. |
| `description` | No | Description for the item, if it is created. |

### remove

Takes from an item's quantity. The item stays in the list at 0.

| Argument | Required | Description |
| --- | --- | --- |
| `item` | Yes | Item name. |
| `quantity` | No | How many to remove. Whole number, 1 or more. Defaults to 1. |

Fails if the item is missing, or if there are not enough.
For example: "Not enough Arrows: have 0, need 1".

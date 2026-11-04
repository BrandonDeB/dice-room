# Inventory

Lists a character's items with editable quantities.

**One per character.** Any [roll's effects](../rolls.md#effects)
can add and remove items from it.

## Example

````markdown
```dicelist
type: inventory
items:
  - name: Arrows
    quantity: 20
    description: Standard ammunition for bows
  - name: Healing Potion
    quantity: 2
```
````

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `type` | Yes | Must be `inventory`. |
| `items` | No | List of items. Each has a `name`, a `quantity`, and an optional `description` shown under its name. |

Item names should be unique. If two items share a name, you will see a warning.

## Editing quantities

Type a new number in an item's box, then press Enter or click away.
The change is saved into the note's YAML.

## Actions

Other components can run these actions on the inventory.
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

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

## Equipment

Items can give [modifiers](modifier.md) while you wear or wield them, such as a +1 to armor
class and saving throws. Add these fields to an item:

| Field | Description |
| --- | --- |
| `equipped` | Whether it's worn or wielded. The card shows an **Equipped** switch. |
| `attunement` | `true` for items that need attunement. The card adds an **Attuned** switch. |
| `attuned` | Whether you're attuned to it. |
| `modifiers` | The modifiers it gives, written like a spell's [`publishes`](attacks.md#publishing-modifiers) list. |

An item's modifiers apply only while it's equipped, and attuned if it needs attunement.
Otherwise rolls list them as switched off. More than three attuned items shows a warning.

```yaml
type: inventory
items:
  - name: Cloak of Protection
    quantity: 1
    equipped: true
    attunement: true
    attuned: true
    modifiers:
      - name: Cloak of Protection
        value: 1
        appliesTo: [armor class, save]
```

Modifiers with the `armor class` category raise the [character](character.md) block's
armor class. Only flat numbers count there, not dice.

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

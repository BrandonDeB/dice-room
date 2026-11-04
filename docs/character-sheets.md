# Character sheets

A character sheet is made of **cards**. Each card is a fenced code block with the language
`dicelist`, containing YAML. A card has a name, a description and a picture, plus any
**components** you add to it: rolls, values, modifiers, an inventory, and so on.

````markdown
```dicelist
type: weapon
name: Longbow
description: Two-handed, heavy. Range 150/600 ft.
rolls:
  - name: Hit
    dice: 1d20 + {{dex mod}} + {{proficiency}}
    categories: [attack, ranged]
  - name: Damage
    dice: 1d8 + {{dex mod}}
    categories: [damage]
```
````

In reading view or live preview, the block becomes an interactive card. Click its buttons to roll.

Nothing about a weapon, spell or character is built in. A weapon is a card with Hit and
Damage rolls; a spell is a card with rolls, effects that spend a spell slot, and maybe a
modifier like Bless; a character is a card with values like level and armor class. See the
[example sheet](example-sheet.md) for a full character to copy.

## Card fields

| Field | Description |
| --- | --- |
| `name` | The card's title. |
| `type` | A tag shown beside the name, such as `weapon` or `spell`, so you can tell cards apart. It's only a label: any card can have any components. |
| `description` | Markdown shown under the title. Links and formatting work. |
| `picture` | An image in your vault, as a path or a wiki link, shown beside the title. |
| `layout` | `grid` shows the card's rolls and values as tiles, like a sheet's ability scores or skill list. |
| `on` | [Event subscriptions](events.md): actions this card runs when an event fires. |

## Components

Add a component by writing its key. They're shown in the order you write them.

| Key | What it adds | Limits |
| --- | --- | --- |
| [`fields`](components/fields.md) | Labelled details, like Class, Speed or Languages | |
| [`values`](components/values.md) | Named numbers that formulas use, like level or armor class | Each name once per character |
| [`rolls`](rolls.md) | Buttons that roll dice and run effects | |
| [`modifiers`](components/modifiers.md) | Bonuses with switches, like Bless or Poisoned | Each name once per character |
| [`consumables`](components/consumables.md) | Spell slots, hit dice, and other limited uses | Each name once per character |
| [`inventory`](components/inventory.md) | Items and quantities | One per character |
| [`health`](components/health.md) | Hit points and temporary hit points | One per character |
| [`events`](components/events.md) | Buttons for rests and other events | |

A card with a field it doesn't know, such as a misspelled component, shows a warning
listing the fields it can have.

## Formulas

Dice and numbers anywhere on a card can use the character's values by name, like
`1d20 + {{dex mod}}`. See [values and formulas](formulas.md).

## Linking notes to a character

A character can be spread across several notes, such as a main sheet, a spellbook,
and an inventory. Give every note for that character the same `character` property
in its frontmatter:

```yaml
---
character: Aria Stormwind
---
```

Cards find each other through this property: a roll in the spellbook can use values from
the main sheet and spend spell slots from another note.

If a note has no `character` property, its cards only look within that same note.

Some things must be unique across all of a character's notes: one inventory, one health,
and each value, modifier and consumable name only once. A card that breaks one of these
shows an error with links to every card involved.

## Editing from the sheet

Switches, counters, quantities and hit points write changes back into your note's YAML.
Comments and formatting in the block are preserved.

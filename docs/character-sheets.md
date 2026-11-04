# Character sheets

A character sheet is made of **components**. Each component is a fenced code block
with the language `dicelist`, containing YAML. The `type` field says which component it is.

````markdown
```dicelist
type: stats
stats: [10, 14, 12, 13, 8, 15]
```
````

In reading view or live preview, the block becomes an interactive panel. Click it to roll.

## Available components

| Type | Purpose | One per character? |
| --- | --- | --- |
| [`stats`](components/stats.md) | Ability scores and saving throws | Yes |
| [`skills`](components/skills.md) | Skill checks | No |
| [`weapon`](components/attacks.md) | Weapon attacks | No |
| [`spell`](components/attacks.md) | Spell attacks | No |
| [`inventory`](components/inventory.md) | Items and quantities | Yes |
| [`modifier`](components/modifier.md) | A bonus rolls can include, with a switch | No, but each name only once |
| [`consumable`](components/consumable.md) | Spell slots and other limited uses | No, but each name only once |

## Linking notes to a character

A character can be spread across several notes, such as a main sheet, a spellbook,
and an inventory. Give every note for that character the same `character` property
in its frontmatter:

```yaml
---
character: Aria Stormwind
---
```

Components find each other through this property. For example, the skills component
reads the stat block from any note with the same `character` value.

If a note has no `character` property, its components only look within that same note.

Components marked "one per character" must appear only once across all of that
character's notes. If there are two, components that depend on them report an error.

## Rolls

Every clickable roll can also change other components, such as spending an arrow
from your inventory. See [rolls and effects](rolls.md).

## Editing from the sheet

Some components write changes back into your note. For example, changing a quantity
in the inventory updates the YAML in the code block. Comments and formatting in the
block are preserved.

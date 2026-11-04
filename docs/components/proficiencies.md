# Proficiencies

Languages, armor and weapon proficiencies, and tools. Tools you roll checks with get a
Roll button.

## Example

````markdown
```dicelist
type: proficiencies
languages: [Common, Elvish]
armor: [Light, Medium, Shields]
weapons: [Simple, Martial]
tools:
  - name: Thieves' tools
    ability: dex
  - Herbalism kit
```
````

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `type` | Yes | Must be `proficiencies`. |
| `languages` | No | Languages you speak. |
| `armor` | No | Armor you're proficient with. |
| `weapons` | No | Weapons you're proficient with. |
| `tools` | No | Tools: a name, or a `name` with the `ability` its checks use. |
| `rolls` | No | Extra modifiers or effects for tool checks, keyed by tool name. See [settings for generated rolls](../rolls.md#settings-for-generated-rolls). |

## Tool checks

A tool with an `ability` rolls a d20 plus that ability's modifier and your proficiency
bonus, from the [stats](stats.md) and [character](character.md) blocks. Right-click for
advantage or disadvantage. Tool checks have the categories `check`, `tool`, the tool's
name and the ability, so a modifier like Guidance applies.

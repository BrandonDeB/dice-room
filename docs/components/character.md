# Character

The character's core numbers. Its **level** sets the proficiency bonus that every other
block of the character uses: saving throws, skills, attacks and spells.

**One per character.**

## Example

````markdown
```dicelist
type: character
name: Aria
class: Ranger
level: 5
armorClass: 15
speed: 30 ft
```
````

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `type` | Yes | Must be `character`. |
| `name` | No | Shown as the card's title. |
| `class` | No | Shown under the name. |
| `level` | No | 1 to 20. Sets the proficiency bonus. |
| `armorClass` | No | Your armor class. |
| `speed` | No | Your speed, such as `30 ft`. |
| `rolls` | No | Extra modifiers or effects for its rolls. See [settings for generated rolls](../rolls.md#settings-for-generated-rolls). |

## What it shows

1. **Proficiency bonus**: +2 at levels 1 to 4, rising by 1 every four levels to +6 at 17.
   Without a level, the [stats](stats.md) block's `proficiencyBonus` is used, or +2.
2. **Armor class** and **speed**, as written.
3. **Initiative**: your Dexterity modifier, with a Roll button. Modifiers can apply to it
   with the `initiative` category.
4. **Passive Perception**: 10 plus your Perception skill bonus from the [skills](skills.md) block.

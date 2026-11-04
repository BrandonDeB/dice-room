# Stats

Shows a character's six ability scores in one row, each with its modifier.

1. **Click an ability** to roll an ability check: a d20 plus the modifier.
2. **Click its Save button** to roll a saving throw: the same, plus your proficiency bonus
   if you are proficient in that save. Proficient saves are highlighted.

**One per character.** The [skills](skills.md) component reads its modifiers from here.

## Example

````markdown
```dicelist
type: stats
stats: [10, 14, 12, 13, 8, 15]
proficiencies: [Dexterity, Wisdom]
proficiencyBonus: 2
```
````

## Fields

| Field              | Required | Description                                                                                   |
| ------------------ | -------- | --------------------------------------------------------------------------------------------- |
| `type`             | Yes      | Must be `stats`.                                                                              |
| `stats`            | Yes      | Six ability scores, in the order below.                                                       |
| `proficiencies`    | No       | Saving throws you are proficient in. Full names like `Dexterity` or abbreviations like `DEX`. |
| `proficiencyBonus` | No       | Added to proficient saving throws, if there is no [character](character.md) block with a level. Defaults to `2`. |
| `rolls` | No | Extra modifiers or effects for its rolls. See [settings for generated rolls](../rolls.md#settings-for-generated-rolls). |

An unrecognized name in `proficiencies` shows a warning above the scores.

### Ability order

The `stats` list is read in this order:

1. Strength
2. Dexterity
3. Constitution
4. Wisdom
5. Intelligence
6. Charisma

Note that Wisdom comes before Intelligence.

## Modifiers

The modifier is the standard one: score minus 10, divided by 2, rounded down.
A 14 gives +2 and an 8 gives -1.

# Skills

Shows all eighteen skills with their bonuses. Click a skill to roll a d20 plus its bonus.

Each skill uses the modifier of its ability from the character's [stats](stats.md) block.
If no stats block is found for the character, all bonuses are +0.

## Example

````markdown
```dicelist
type: skills
proficiency: [Stealth, Perception]
expertise: [Sleight of Hand]
```
````

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `type` | Yes | Must be `skills`. |
| `proficiency` | No | Skills you are proficient in. Adds your proficiency bonus. |
| `expertise` | No | Skills you have expertise in. Adds twice your proficiency bonus. |
| `rolls` | No | Extra modifiers or effects for its rolls. See [settings for generated rolls](../rolls.md#settings-for-generated-rolls). |

The proficiency bonus comes from the [character](character.md) block's level, or the
[stats](stats.md) block's `proficiencyBonus`, or +2. A skill listed under both fields counts as expertise.

Skill names are not case sensitive, but must otherwise match the list below.

## Skills and their abilities

| Skill | Ability |
| --- | --- |
| Acrobatics | Dexterity |
| Animal Handling | Wisdom |
| Arcana | Intelligence |
| Athletics | Strength |
| Deception | Charisma |
| History | Intelligence |
| Insight | Wisdom |
| Intimidation | Charisma |
| Investigation | Intelligence |
| Medicine | Wisdom |
| Nature | Intelligence |
| Perception | Wisdom |
| Performance | Charisma |
| Persuasion | Charisma |
| Religion | Intelligence |
| Sleight of Hand | Dexterity |
| Stealth | Dexterity |
| Survival | Wisdom |

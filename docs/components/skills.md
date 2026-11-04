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
| `proficiency` | No | Skills you are proficient in. Adds +2. |
| `expertise` | No | Skills you have expertise in. Adds +4. |

Skill names are not case sensitive, but must otherwise match the list below.
Do not list a skill under both fields.

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

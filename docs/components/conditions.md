# Conditions

Tracks the conditions affecting a character, and exhaustion. Each condition says what it
does to your rolls, as a reminder: apply it when you roll, by right-clicking the roll and
choosing advantage, disadvantage, or [a modifier for that roll](../rolls.md#a-modifier-for-one-roll).
Conditions aren't added to every roll automatically, so they don't crowd your rolls.

**One per character.**

## Example

````markdown
```dicelist
type: conditions
active: [poisoned]
exhaustion: 0
```
````

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `type` | Yes | Must be `conditions`. |
| `active` | No | The conditions in effect. The switches save this for you. |
| `exhaustion` | No | 0 to 6. The minus and plus buttons save this for you. |

## What each condition reminds you of

| Condition | Effect |
| --- | --- |
| Blinded, Prone, Restrained | Disadvantage on attack rolls |
| Frightened, Poisoned | Disadvantage on attack rolls and ability checks |
| Invisible | Advantage on attack rolls |
| Charmed, Deafened, Grappled, Incapacitated, Paralyzed, Petrified, Stunned, Unconscious | Tracked only |

**Exhaustion** uses the 2024 rules: each level takes 2 off every attack roll, ability check
and saving throw, so add it with "Roll with a modifier" (such as `-4` at level 2). Level 6 is
death. A [long rest](rest.md) removes one level.

## Actions

| Action | Arguments | What it does |
| --- | --- | --- |
| `add` | `name` | Adds a condition, such as `poisoned`. |
| `remove` | `name` | Removes it. |

For example, a poisoned dagger's effect, or a potion that cures poison:

```yaml
effects:
  - target: conditions
    action: remove
    args:
      name: poisoned
```

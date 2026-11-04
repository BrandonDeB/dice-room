# Conditions

Tracks the conditions affecting a character, and exhaustion. Conditions that change your
own rolls apply automatically, as [modifiers](modifier.md).

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

## What each condition does to your rolls

| Condition | Effect |
| --- | --- |
| Blinded, Prone, Restrained | Disadvantage on attack rolls |
| Frightened, Poisoned | Disadvantage on attack rolls and ability checks |
| Invisible | Advantage on attack rolls |
| Charmed, Deafened, Grappled, Incapacitated, Paralyzed, Petrified, Stunned, Unconscious | Tracked only |

Effects on other creatures' rolls, and automatic failures, are not applied: the card only
changes your own rolls. Advantage and disadvantage cancel out, so being both invisible and
poisoned makes your attacks normal.

**Exhaustion** uses the 2024 rules: each level takes 2 off every attack roll, ability check
and saving throw. Level 6 is death. A [long rest](rest.md) removes one level.

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

# Conditions

Tracks the conditions affecting a character, and exhaustion. While a condition that changes
your own rolls is on, it applies to them as a [modifier](modifier.md), and those rolls list it,
such as "Includes Poisoned (disadvantage)". Conditions that are off don't appear anywhere,
so your rolls stay uncluttered.

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

Effects on other creatures' rolls, and automatic failures, are not applied: only your own
rolls change. Advantage and disadvantage cancel out, so being both invisible and poisoned
makes your attacks normal.

**Exhaustion** uses the 2024 rules: each level takes 2 off every attack roll, ability check
and saving throw while it's above 0. Level 6 is death. A [long rest](rest.md) removes one level.
If you'd rather not track it here, add it to a single roll with
[a modifier for that roll](../rolls.md#a-modifier-for-one-roll).

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

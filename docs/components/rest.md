# Rest

Buttons for a short rest, a long rest, or any other moment that refills things.
Taking a rest fires a character [event](../events.md) with that name. Everything
subscribed to the event reacts, across all of the character's notes: for example,
[consumables](consumable.md) refill, gain or lose, and any block with an `on` list runs
its actions.

Each row previews what its event would change, such as
"Refills 1st-level spell slots (1 of 4 left)", linking to the block it would change.
After you take it, a notice says what changed, and anything that couldn't be done.

## Example

````markdown
```dicelist
type: rest
```
````

With your own events:

````markdown
```dicelist
type: rest
events: [Short rest, Long rest, Dawn]
```
````

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `type` | Yes | Must be `rest`. |
| `events` | No | The events to offer, one row each. Defaults to Short rest and Long rest. Names are not case sensitive. |

## Firing events from rolls

A roll can fire an event too, with an [effect](../rolls.md#firing-events):

```yaml
hitRoll:
  dice: 1d20
  effects:
    - target: event
      action: emit
      args:
        name: short rest
```

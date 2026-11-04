# Events

An **event** is a moment in the game that changes things across a character: a short
rest, a long rest, dawn, or anything else you name. When an event fires, every block
subscribed to it reacts, across all of the character's notes.

Event names are not case sensitive: `Long Rest` and `long rest` are the same event.

## Firing an event

1. Take it from a [rest](components/rest.md) block, which has a button per event.
2. Fire it from a roll, with an [effect](rolls.md#firing-events) using `target: event`.

Before you fire it, both show what would change. Afterwards a notice says what changed.

## Subscribing any component

Any block whose component has actions can react to events with an `on` list. Each entry
names an event and one of that component's actions, with its arguments, just like a roll
effect without a `target`. When the event fires, the block runs that action on itself.

An inventory that picks fresh berries every dawn:

```yaml
type: inventory
items:
  - name: Rations
    quantity: 3
on:
  - event: dawn
    action: add
    args:
      item: Goodberry
      quantity: 10
```

A modifier that ends on a long rest:

```yaml
type: modifier
name: Bless
value: 1d4
active: true
appliesTo: [attack, save]
on:
  - event: long rest
    action: "off"
```

Entries run in order. If one fails, such as removing more than you have, the others still
run and the notice says what couldn't be done. Each component's page lists its actions.

If an `on` list has a mistake, such as an entry without an event or an action the
component doesn't have, the block shows a warning at the top.

## Consumable shortcuts

[Consumables](components/consumable.md) can also subscribe per entry, without an `on` list:

```yaml
type: consumable
consumables:
  - name: Wand of Magic Missiles
    max: 7
    gain: { dawn: 2 }
  - name: Ki points
    max: 5
    refill: [short rest, long rest]
  - name: Favor
    max: 3
    lose: { long rest: 1 }
```

1. `refill`: the events that refill it to full.
2. `gain`: events with how many come back. It never goes above the max.
3. `lose`: events with how many are lost. It never goes below zero, so it never fails.

If one event does several of these, they apply in that order: refill, then gain, then lose.

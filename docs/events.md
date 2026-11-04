# Events

An **event** is a moment in the game that changes things across a character: a short
rest, a long rest, dawn, or anything else you name. When an event fires, every card
subscribed to it reacts, across all of the character's notes.

Event names are not case sensitive: `Long Rest` and `long rest` are the same event.

## Firing an event

1. From an [events](components/events.md) component, which has a button per event.
2. From a roll, with an [effect](rolls.md#firing-events) using `target: event`.

Before you fire it, both show what would change. Afterwards a notice says what changed.

## Subscribing a card

Any card can react to events with an `on` list. Each entry names an event, one of the
card's own components as its `target`, and one of that component's actions with its
arguments, like a roll effect. When the event fires, the card runs that action on itself.

A character card that recovers on a long rest:

```yaml
name: Aria
health: { max: 38, current: 12 }
values:
  - { name: Exhaustion, value: 2, min: 0, max: 6 }
on:
  - event: long rest
    target: health
    action: restore
  - event: long rest
    target: values
    action: decrease
    args: { name: Exhaustion }
```

An inventory that picks fresh berries every dawn:

```yaml
inventory:
  - { name: Rations, quantity: 3 }
on:
  - event: dawn
    target: inventory
    action: add
    args: { item: Goodberry, quantity: 10 }
```

A modifier that ends on a long rest:

```yaml
modifiers:
  - { name: Bless, value: 1d4, active: true, appliesTo: [attack, save] }
on:
  - event: long rest
    target: modifiers
    action: "off"
    args: { name: Bless }
```

Entries run in order. If one fails, such as removing more than you have, the others still
run and the notice says what couldn't be done. Each component's page lists its actions.

If an `on` list has a mistake, such as an entry without a target, or an action the
component doesn't have, the card shows a warning at the top.

## Consumable shortcuts

[Consumables](components/consumables.md) can also subscribe per entry, without an `on` list:

```yaml
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

## Concentration

Switching on a modifier with `concentration: true` fires a "concentrate on" event, which
switches off every other concentration modifier. See [concentration](components/modifiers.md#concentration).

# Events

Buttons that fire character [events](../events.md), such as a short or long rest, or dawn.

## Example

````markdown
```dicelist
name: Rest
events: [Short rest, Long rest]
```
````

`events` is a list of event names. Each gets a row with a **Trigger** button.

## What it shows

Each row previews what its event would change, such as "Refills 1st-level spell slots
(1 of 4 left)", with each line linking to the card it changes. If nothing is subscribed,
the row says "Nothing to change". Previews update when any of the character's notes change.

Click **Trigger** to fire the event. A notice announces everything that changed, such as
"Long rest: Refilled 1st-level spell slots (4 of 4 left)."

## What reacts to events

1. [Consumables](consumables.md) with the event in their `refill`, `gain` or `lose`.
2. Any card with an [`on` list](../events.md#subscribing-a-card) entry for the event.

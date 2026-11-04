# Fields

Labelled details shown as rows on a card, such as a character's class and speed, a
weapon's range, or a spell's casting time. A list reads as "Common, Elvish".

## Example

````markdown
```dicelist
type: spell
name: Hail of Thorns
fields:
  Level: 1
  School: Conjuration
  Casting time: Bonus action
  Components: [V]
```
````

Each key is a row's label, and its value is shown as written. Fields are only shown:
formulas can't use them. For a number that rolls or other values use, such as level or
speed, write a [value](values.md) instead.

# Values and formulas

A **formula** is dice and arithmetic that can use the character's **values** by name.
Formulas work anywhere dice or numbers go: a roll's `dice`, a modifier's `value`, and
another value.

```yaml
values:
  - { name: dex, value: 16 }
  - { name: dex mod, value: "floor(({{dex}} - 10) / 2)" }
  - { name: level, value: 5 }
  - { name: proficiency, value: "2 + floor(({{level}} - 1) / 4)" }
rolls:
  - name: Stealth
    dice: 1d20 + {{dex mod}} + 2 * {{proficiency}}
```

Values come from any card belonging to the character, in any of its notes. See the
[values component](components/values.md) for how to write them.

## What a formula can use

1. Dice, like `1d20`, `2d6` or `d8`.
2. Numbers, like `3` or `-1`.
3. Values, in double braces: `{{dex mod}}`. Names aren't case sensitive, and can have spaces.
4. Note properties, as `{{Characters/Aria.speed}}`: the note's path without `.md`, a dot,
   and the property. These are used when no value has that name.
5. `+`, `-`, `*`, `/` and parentheses.
6. `floor`, `ceil`, `round`, `abs`, `min` and `max`, such as `max({{str mod}}, {{dex mod}})`
   for a finesse weapon.

The number a formula comes to is rounded down, so `({{dex}} - 10) / 2` works out an
ability modifier without `floor`.

## Rules for dice

Dice are thrown and added up, so a formula can add dice but not subtract, multiply or
divide them. `1d20 + 1d4 + 3` works; `1d20 - 1d4` and `2 * 1d6` say why they can't.
Write `2d6` instead of `2 * 1d6`.

## Mistakes

A formula that names a value the character doesn't have, or has a typo, shows why on its
card, such as `No value named "dex mod" for this character`, and its roll can't be made.
Values that use each other in a circle say so too.

## Conditions

An effect's `if` is a formula that compares, such as `$total >= 10`. It can use `>`, `<`,
`>=`, `<=`, `==` and `!=`, joined with `and` and `or`. After a roll, `$total` is what the
roll came to and `$natural` is the d20 that counted. See [conditional effects](rolls.md#conditional-effects).

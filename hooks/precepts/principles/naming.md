# Naming — Clean Code Ch. 2

The destilled rules are in `_summary.md`. This file is the extended reference.

## Intention-revealing names

Your name should answer three questions: why it exists, what it does, how it's used. If the name needs a comment, it's wrong.

```ts
// BAD
const d = Date.now();                    // elapsed time in days

// GOOD
const elapsedTimeInDays = Date.now();
```

## Avoid disinformation

A name must not mean something different from its behavior. `accountList` that is actually a `Map` lies. `XYZHelper` doing core logic lies. `safe` for unsafe code lies.

Rename to match reality, even when it's inconvenient.

## Make meaningful distinctions

Don't disambiguate with noise words (`Info`, `Data`, `Processor`, `Manager`) when the distinction is arbitrary. `ProductInfo` vs `ProductData` is nonsense. Two names should differ only when they represent different concepts.

## Pronounceable names

`genymdhms` is worse than `generationTimestamp`. If you can't discuss a variable over the phone, rename it.

## Searchable names

Single-character names and magic numbers are unsearchable. Name the constant.

```ts
// BAD
for (let i = 0; i < 7; i++) { /* ... */ }

// GOOD
const DAYS_IN_WEEK = 7;
for (let day = 0; day < DAYS_IN_WEEK; day++) { /* ... */ }
```

Loop indices `i`/`j`/`k` in tight scopes are an accepted exception.

## Avoid encodings

No Hungarian notation. No `m_` prefixes. No interface prefix `I`. Modern tooling makes type/scope visible — names shouldn't carry that load.

## Class names

Nouns or noun phrases: `Customer`, `WikiPage`, `Account`, `AddressParser`. Avoid verbs (`Manager`, `Processor`, `Data`, `Info`).

## Method names

Verbs or verb phrases: `postPayment`, `deletePage`, `save`. Accessors/mutators/predicates prefixed per the language idiom:
- Accessors: `getName()` or `name` (property)
- Mutators: `setName(name)`
- Predicates: `isPosted()`, `hasChildren()`

## One word per concept

Pick one verb for one abstract concept and stick with it. Don't mix `fetch`/`retrieve`/`get` in the same codebase for the same operation. Consistency is readability.

## Don't pun

One word for one concept also means the same word shouldn't mean two different things. `add()` that sometimes appends and sometimes mutates total is a pun.

## Use solution-domain names

Programmers will read your code. Use CS/pattern terms (`JobQueue`, `AccountVisitor`, `Factory`) — don't waste a name on a literal-domain translation when the pattern name is clearer.

## Use problem-domain names

When there's no solution-domain term that fits, use the problem-domain name. Don't invent cute abstractions.

## Add meaningful context

Names like `state`, `city`, `zipcode` alone are fine only within `Address`. Standalone, prefix them: `addrState`. Better: wrap in a class that makes the context explicit.

## Don't add gratuitous context

`MACAddress` inside an `AccountManager` class doesn't need to be `AccountManagerMACAddress`. Let the enclosing scope carry what it already carries.

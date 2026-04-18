# Functions — Clean Code Ch. 3

The destilled rules are in `_summary.md`. This file is the extended reference.

## Small

Functions should be small. Then smaller than that. Uncle Bob's own ceiling is ~20 lines; ideal is 5-10. Nesting deeper than 2 is a smell.

```ts
// BAD — 45 lines, 4 levels deep
function renderPageWithSetupsAndTeardowns(request, isSuite) { /* ... */ }

// GOOD — 4 lines, one level, each helper ≤15 lines
function renderPageWithSetupsAndTeardowns(request, isSuite) {
  if (isTestPage(request)) return includeSetupAndTeardownPages(request, isSuite);
  return renderPage(request);
}
```

## Do one thing

Functions should do one thing. They should do it well. They should do it only.

**Test**: can you describe it in one sentence without the word "and"? If not, it's doing more than one thing.

```ts
// BAD
function validateAndSave(user) { /* validation + persistence */ }

// GOOD
function validate(user) { /* ... */ }
function save(user) { /* ... */ }
```

## One level of abstraction per function

Don't mix domain vocabulary with low-level I/O in the same function. Either you're talking about `order.submit()` or you're talking about `socket.write(buf, 0, 1024)` — not both.

**Step-down rule**: the function at line N should be at a higher abstraction level than the functions it calls. Reading top-to-bottom should be like reading a narrative, each paragraph leading to more detail.

## Switch statements

`switch` / big `if` chains are inherently violations of SRP and OCP. Tolerate them in a factory buried low in the architecture; eliminate them everywhere else in favor of polymorphism.

```ts
// BAD — this switch will grow every time a new shape type appears
function area(shape) {
  switch (shape.kind) {
    case "circle": return Math.PI * shape.r ** 2;
    case "square": return shape.side ** 2;
  }
}

// GOOD — each Shape subclass owns its `area` method
interface Shape { area(): number }
class Circle implements Shape { area() { /* ... */ } }
```

## Use descriptive names

A long descriptive name is better than a short enigmatic one. `includeSetupAndTeardownPages` reads like English. `handle()` reads like nothing.

Be consistent with the naming pattern across the file/module.

## Function arguments

Zero arguments is best. One (monadic) and two (dyadic) are fine. Three (triadic) should raise an eyebrow. Four or more (polyadic) require strong justification — usually an argument object is the right answer.

```ts
// BAD
function createUser(name, email, age, country, role, isAdmin) { /* ... */ }

// GOOD
interface NewUserParams { name: string; email: string; age: number; country: string; role: Role }
function createUser(params: NewUserParams): User { /* ... */ }
```

### Flag arguments

`render(page, true)` — the `true` tells the reader the function does two things and the caller picks. Ugly. Split.

```ts
// BAD
function render(page, isAdmin) { /* ... */ }

// GOOD
function renderPage(page) { /* ... */ }
function renderAdminPage(page) { /* ... */ }
```

## Have no side effects

A function that claims to do one thing shouldn't secretly do another. If `checkPassword(user, pwd)` also starts a session, you've lied to the caller.

Return the value that conveys what happened; let the caller decide on effects. Or rename: `checkPasswordAndStartSession`.

## Command/Query Separation

A function either does something or answers something. Not both.

```ts
// BAD
if (set("username", "bob")) { /* was the set successful? */ }

// GOOD
if (attributeExists("username")) {
  setAttribute("username", "bob");
}
```

## Prefer exceptions to returning error codes

Error codes force the caller to deal with error handling immediately, tangling policy with mechanism. Exceptions let the success path stay clean.

```ts
// BAD
if (deletePage(page) === E_OK) {
  if (registry.deleteReference(page.name) === E_OK) {
    if (configKeys.deleteKey(page.name.makeKey()) === E_OK) { /* ... */ }
  }
}

// GOOD
try {
  deletePage(page);
  registry.deleteReference(page.name);
  configKeys.deleteKey(page.name.makeKey());
} catch (e) { /* handle once */ }
```

## Don't repeat yourself

If the same logic appears in 3 functions, it's a function. Duplication is the root of most maintenance pain.

## Structured programming

A function has one entry and one exit. Prefer one `return` at the end in small functions. `break` / `continue` / early `return` are fine in short functions where they aid clarity — forbidden only in long functions where they hurt.

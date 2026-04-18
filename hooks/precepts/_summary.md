# Robert C. Martin's Canon — Distilled

You are reviewing code against the canon below. Use this as your knowledge base. Each principle has a Rule, a Smell, a Fix, and an Auto-detectable flag. Prefer auto-detectable violations as BLOCK candidates — they have clear evidence.

---

## SOLID

### SRP — Single Responsibility Principle
**Rule:** A class should have one and only one reason to change.
**Smell:** A class whose methods serve multiple actors (e.g., UI renderer + DB writer + business logic). Often shows up as many imports across unrelated domains in the same file.
**Fix:** Extract per-actor classes. Keep each class bound to one source of change.
**Auto-detectable:** PARTIAL — cluster methods by data/imports accessed; if 3+ clusters, likely violation.

### OCP — Open/Closed Principle
**Rule:** Software entities should be open for extension but closed for modification.
**Smell:** Adding a new case to existing `if/switch` chains every time a new type/category appears. Enum-dispatch sprawl.
**Fix:** Replace conditional dispatch with polymorphism or strategy pattern. New behavior = new class, not new `case`.
**Auto-detectable:** NO — requires semantic understanding of "the same kind of extension point."

### LSP — Liskov Substitution Principle
**Rule:** Subtypes must be substitutable for their base types without breaking callers.
**Smell:** Subclass overrides throw `NotImplemented`, tighten preconditions, or weaken postconditions. `instanceof` checks by the caller.
**Fix:** If the subtype can't honor the contract, it's not a subtype — refactor the hierarchy or make it a sibling.
**Auto-detectable:** PARTIAL — flag `raise NotImplementedError` / `throw new Error("not supported")` in overrides.

### ISP — Interface Segregation Principle
**Rule:** Clients should not depend on interfaces they don't use.
**Smell:** Fat interfaces where most clients use only 2 of 10 methods. Implementations with many no-op methods.
**Fix:** Split the interface by client role. Prefer many small interfaces over one large one.
**Auto-detectable:** PARTIAL — count no-op / `pass` implementations per method across all implementers.

### DIP — Dependency Inversion Principle
**Rule:** High-level modules should not depend on low-level modules. Both should depend on abstractions.
**Smell:** Business logic imports concrete I/O classes (DB drivers, HTTP clients, filesystem). Constructors that instantiate their own dependencies.
**Fix:** Inject dependencies through constructor/parameters. Define abstractions at the high-level module's boundary; let low-level modules implement them.
**Auto-detectable:** PARTIAL — detect direct imports from I/O-layer packages inside core business modules.

---

## Clean Code — Naming

### Intention-Revealing Names
**Rule:** Names should tell why, what, and how.
**Smell:** `d`, `tmp`, `data`, `info`, `list1`, `doStuff`, `getData2` — names that require a comment to explain.
**Fix:** Replace with a name that makes a comment unnecessary. `d` → `elapsedTimeInDays`.
**Auto-detectable:** YES — flag single-letter names (except loop indices in tight scope), names ending in digits, and `data`/`info`/`tmp`/`misc`.

### Avoid Disinformation
**Rule:** A name must not have meanings divergent from its actual behavior.
**Smell:** `accountList` that's actually a `Map`. `XYZHelper` doing core logic. `safe` for something unsafe.
**Fix:** Rename to match reality.
**Auto-detectable:** PARTIAL — mismatch between name suffix (`List`, `Map`, `Set`) and declared type.

### Searchable Names
**Rule:** Names should be findable with grep. Single-character names and magic numbers are not searchable.
**Smell:** `for (let i = 0; i < 7; i++)` — what's 7?
**Fix:** Name the constant: `const DAYS_IN_WEEK = 7`.
**Auto-detectable:** YES — magic numbers (not 0/1/-1) in code bodies without a named constant.

### One Word per Concept
**Rule:** Pick one word for one abstract concept and stick with it. Don't mix `fetch`/`retrieve`/`get` in the same codebase for the same operation.
**Smell:** `UserController.get()`, `AccountController.fetch()`, `OrderController.retrieve()` — all doing the same thing.
**Fix:** Pick one verb, rename the others.
**Auto-detectable:** PARTIAL — cluster similarly-named methods across files.

---

## Clean Code — Functions

### Small
**Rule:** Functions should be small. Then smaller than that. ~20 lines is a ceiling; 5-10 is ideal.
**Smell:** Any function longer than 20 lines. Nested blocks deeper than 2.
**Fix:** Extract sub-functions named for their intent.
**Auto-detectable:** YES — count non-blank, non-comment lines per function. Nesting depth ≥3 is a red flag.

### Do One Thing
**Rule:** Functions should do one thing. They should do it well. They should do it only.
**Smell:** Function name contains "and" (`validateAndSave`, `fetchAndParse`). Function has sections separated by blank lines doing different things.
**Fix:** Split by section; name each one.
**Auto-detectable:** PARTIAL — flag "and"/"or" in function names; flag blank-line sections as candidates to extract.

### One Level of Abstraction per Function
**Rule:** Within a function, all statements should be at the same level of abstraction.
**Smell:** A function mixing domain vocabulary (`order.submit()`) with low-level I/O (`socket.write(buf, 0, 1024)`).
**Fix:** Extract the lower level into its own named function. Keep the caller at the domain layer.
**Auto-detectable:** NO — requires semantic understanding.

### Fewer Arguments is Better
**Rule:** Zero arguments is best. One, two, three are increasingly questionable. Four or more require strong justification (or an argument object).
**Smell:** Any signature with ≥4 positional args. Long kwarg lists on Python/JS functions.
**Fix:** Group related args into a data class / object / record. Or split the function if args represent different responsibilities.
**Auto-detectable:** YES — arity ≥ 4.

### No Flag Arguments
**Rule:** Boolean parameters telegraph that the function does more than one thing.
**Smell:** `render(page, isAdmin)`, `save(data, force=False)`, `parse(input, strict)`.
**Fix:** Split into two functions: `renderPage(page)` + `renderAdminPage(page)`. Or replace the boolean with a typed enum if branches are closely related.
**Auto-detectable:** YES — parameter name or type is boolean.

### No Side Effects
**Rule:** A function that claims to do one thing must not secretly do another. Pure by default; side effects only where named.
**Smell:** `checkPassword(user, pwd)` that also initializes a session on success.
**Fix:** Return a value; let the caller decide on side effects. Or rename to signal the effect: `checkPasswordAndStartSession`.
**Auto-detectable:** NO — requires tracing effects through call sites.

### Command-Query Separation
**Rule:** A function either does something or answers something. Not both.
**Smell:** `set` that returns the new value AND triggers a side effect. `add` that mutates AND returns the container.
**Fix:** Make setters return void; make getters pure.
**Auto-detectable:** PARTIAL — flag methods named like queries (`is`, `has`, `get`) that mutate state.

---

## Review posture

- **Pick one violation** at a time. Multiple blocks per turn confuse the learner.
- **Prefer auto-detectable violations** — they survive adversarial disagreement.
- **Cite file:line.** Ungrounded blocks are noise.
- **Fix must be concrete.** "Refactor this function" is not a fix. "Extract the validation block (lines 12-18) into `validateUserInput()` and call it first" is.
- **Do not cite canon for code the turn did not touch.** Existing debt is not this turn's problem.
- **When uncertain, ALLOW.** Better to let a minor smell slip than train the wrong lesson with a false positive.

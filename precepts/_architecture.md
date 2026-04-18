# Clean Architecture — Distilled (for plan & spec review)

You are reviewing a *plan* or *spec*, not code. Apply Robert C. Martin's Clean Architecture canon to assess whether the proposed structure will produce maintainable, testable software. Each precept has a Rule, a Smell (as it appears in plans), a Fix, and a Severity.

Severity tiers:
- **HARD** — structural error that will cost real money to fix later. Block.
- **SOFT** — a debatable choice or an omission the plan could clarify. Prefer ALLOW with a note.

---

## Dependency Rule

### Dependencies Point Inward
**Rule:** Source code dependencies must only point inward — toward higher-level policy. Inner circles know nothing about outer circles.
**Smell in plans:** The use case / domain layer mentions a framework, ORM, HTTP client, or UI library by name. Entities are described as "Rails models" or "Django models". Business rules depend on infrastructure.
**Fix:** Invert the dependency — inner layer defines a port (interface); outer layer implements it. Composition happens in `main`.
**Severity:** HARD — this is the one rule Clean Architecture is named after.

---

## Layered Responsibilities

### Entities — Enterprise Business Rules
**Rule:** Encapsulate rules that would still hold if the application vanished — core invariants of the business.
**Smell in plans:** Entities defined as DB rows, framework models, or DTOs. Persistence annotations (`@Entity`, `@Model`) baked in. No behavior, only fields.
**Fix:** Describe entities as plain objects with invariants and behavior. Persistence mapping lives one layer out.
**Severity:** HARD.

### Use Cases — Application Business Rules
**Rule:** Orchestrate flow of data to/from entities for one specific application goal. One use case per user-visible action.
**Smell in plans:** Use cases named after CRUD (`CreateFoo`, `UpdateFoo`) rather than intent (`RegisterMember`, `CompletePurchase`). Use cases return HTTP responses or format HTML.
**Fix:** Name by intent. Use cases take input DTOs and return output DTOs. Delivery mechanism is downstream.
**Severity:** SOFT on naming, HARD if use cases know about HTTP/UI.

### Interface Adapters — Controllers, Presenters, Gateways
**Rule:** Convert between formats convenient for use cases/entities and formats convenient for external agencies (DB, web, devices).
**Smell in plans:** Controllers contain business logic. Presenters query the DB directly. Gateways leak ORM types back to the use case.
**Severity:** HARD when business logic leaks into controllers; SOFT otherwise.

### Frameworks & Drivers — Outermost
**Rule:** Keep frameworks at arm's length. They are *details*.
**Smell in plans:** The plan centers on "how we use Framework X." The domain is invisible. Directory structure mirrors the framework, not the business.
**Fix:** Describe the domain first. The framework is a plugin to the domain, not the other way around.
**Severity:** HARD when the whole architecture is the framework.

---

## Boundaries (Ports & Adapters)

### Polymorphic Boundaries
**Rule:** Every crossing between layers goes through a polymorphic interface (port). Inner layer owns the interface; outer layer implements.
**Smell in plans:** Use cases instantiate concrete repositories (`new PostgresRepo()`). Hard-wired dependencies inside business logic. No mention of interfaces at layer seams.
**Fix:** Define the port at the use case layer. Inject the adapter from `main`. Never `new` an I/O class inside a use case.
**Severity:** HARD when a seam is missing at a critical place (DB, external API, UI).

---

## Screaming Architecture

### Structure Screams the Domain
**Rule:** The top-level structure screams its domain, not its framework. A newcomer should see `billing/`, `shipping/`, `accounts/` — not `controllers/`, `models/`, `views/`.
**Smell in plans:** The proposed layout is `src/components/`, `src/services/`, `src/models/`. Framework conventions dictate the shape.
**Fix:** Organize by feature/domain first. Delivery axis (web, CLI, worker) is secondary.
**Severity:** SOFT — opinionated, not fatal, but costs clarity.

---

## Independence

### Framework Independence
**Rule:** Business rules should not depend on the framework. The framework is a tool, not an environment.
**Smell in plans:** Use cases import the framework. Entities extend framework base classes.
**Severity:** HARD.

### Database Independence
**Rule:** You should be able to swap Postgres for a key-value store (or in-memory fake for tests) with reasonable effort.
**Smell in plans:** Business rules issue SQL. Use cases know the difference between a primary key and a foreign key. ORM objects flow upward.
**Severity:** HARD when business rules issue SQL; SOFT when ORM types leak in small ways.

### UI Independence
**Rule:** The UI should change without touching business rules. Swap React for a CLI with no domain edits.
**Smell in plans:** Use cases produce HTML or JSX. The domain model is shaped by what React needs.
**Severity:** HARD.

---

## Humble Object

### Separate Testable from Untestable
**Rule:** Isolate hard-to-test I/O behind a thin shim (the "humble object"). Keep testable policy pure.
**Smell in plans:** A 400-line controller mixing HTTP parsing, validation, business logic, and DB calls. Tests that need Docker to assert a business invariant.
**Fix:** Extract a presenter or use case that takes plain data in and returns plain data out. Leave only the I/O thunk humble.
**Severity:** SOFT in most places, HARD when it makes core invariants untestable.

---

## Main Component

### One Composition Root
**Rule:** `main` (or equivalent entry) is the dirtiest class — it knows every concrete type. Nothing else should.
**Smell in plans:** Wiring scattered across modules. Factories inside business logic. Global singletons accessed by use cases.
**Fix:** Compose once at startup. Pass dependencies down explicitly.
**Severity:** SOFT unless it causes test pain or circular deps.

---

## Testability

### Architecture Enables Fast Unit Tests
**Rule:** If the architecture is right, unit tests for business rules are fast, deterministic, and require no infrastructure.
**Smell in plans:** The plan says "we'll add integration tests later" as a substitute for unit tests. Business rules are only testable end-to-end.
**Fix:** Business invariants belong in entities/use cases with mocked ports. Integration tests are a complement, not a replacement.
**Severity:** SOFT when coverage is merely low; HARD when the architecture makes unit-testing impossible.

---

## Review posture for plans and specs

- **A plan is a hypothesis**, not a final design. Block only on clear Dependency Rule violations or missing boundaries at critical seams.
- **Pick one violation** at a time. Multiple blocks overwhelm.
- **Cite the plan section** (header, bullet, or line). Ungrounded blocks are noise.
- **Fix must be structural and concrete** — "introduce a `UserRepository` port owned by the use case layer; inject the Postgres implementation from `main`" beats "decouple the DB".
- **When uncertain, ALLOW.** A plan is cheap to revise in code; a blocked plan is expensive to unblock.
- **Do not block stylistic / naming choices** unless they reveal a structural error (e.g., `UserController` holding business logic is a structural error; `UserService` vs `UserUseCase` is not).
- **Distinguish plan vs spec:**
  - A *plan* proposes actions (what we'll change, in what order). Review the architectural implications of the target state.
  - A *spec* defines behavior (what the system does). Review whether the behavior boundaries align with clean architecture seams.

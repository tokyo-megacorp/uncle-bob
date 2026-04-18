# Clean Architecture — Principles

Source: Robert C. Martin, *Clean Architecture* (2017). These principles govern structure, not syntax — they apply to plans, module layouts, and dependency graphs, not line-level code.

---

## The Dependency Rule

**Rule:** Source code dependencies must point only inward, toward higher-level policy. Nothing in an inner circle can know anything about something in an outer circle.

**Smell:** Business rules `import` from a web framework, ORM, or UI toolkit. A use case mentions Express, Django, React, or a concrete DB class by name.

**Fix:** Invert the dependency: the inner layer defines an interface (port); the outer layer implements it (adapter). The `main` component wires them at startup.

---

## Layered Circles

From innermost to outermost — each layer knows only about layers further in:

### Entities (Enterprise Business Rules)
**Rule:** Encapsulate the most general and high-level rules — the policies that would still apply if the application disappeared tomorrow.
**Smell:** Entity classes annotated with `@Entity` (JPA), `@Model` (Django), or serialization decorators. Getters/setters that mirror a DB schema 1:1.
**Fix:** Keep entities as plain objects with behavior. Persistence mapping lives in an outer layer.

### Use Cases (Application Business Rules)
**Rule:** Orchestrate the flow of data to and from entities for a specific application goal. One use case per user-visible action.
**Smell:** Use cases that return `Response` objects, import `request`, or format HTML. Use cases named after CRUD (`CreateUser`) instead of intent (`RegisterNewMember`).
**Fix:** Use cases accept input DTOs, return output DTOs, and know nothing about delivery mechanism.

### Interface Adapters (Controllers, Presenters, Gateways)
**Rule:** Convert data between the format convenient for use cases/entities and the format convenient for external agencies (DB, web, devices).
**Smell:** Controllers that contain business logic. Presenters that query the DB directly. Gateways that leak ORM types upward.

### Frameworks & Drivers (Outermost)
**Rule:** Keep frameworks at arm's length — they are details.
**Smell:** The plan centers around "how we use Framework X." The domain is invisible.

---

## Boundaries (Ports & Adapters)

**Rule:** Every crossing between layers goes through a polymorphic interface (port). The inner layer owns the interface; the outer layer implements it.

**Smell:** A use case calls `new PostgresUserRepo()` directly. Hard-wired instantiation inside business logic.

**Fix:** Define the repository interface in the use case layer. Inject the concrete implementation from `main`. Never construct I/O inside a use case.

---

## Screaming Architecture

**Rule:** The top-level structure of the codebase should scream its domain, not its framework. A newcomer browsing directories should see `accounts/`, `billing/`, `shipping/` — not `controllers/`, `models/`, `views/`.

**Smell:** The plan proposes `src/components/`, `src/services/`, `src/models/` as top-level structure. Framework conventions dictate the shape.

**Fix:** Organize by feature/domain first. Delivery mechanism (web, CLI, worker) is a secondary axis.

---

## Framework, Database, UI Independence

**Rule:** Business rules should run without the framework, without the database, and without the UI. You should be able to swap any of them with reasonable effort.

**Smell:** "We can't test this without spinning up Postgres." "The use case imports React." "The domain model extends `ActiveRecord`."

**Fix:** All I/O lives behind a port. Tests for business rules use in-memory fakes. The framework is a plugin to the business logic, not the other way around.

---

## Humble Object

**Rule:** Separate hard-to-test behavior (UI rendering, DB calls, network I/O) from easy-to-test policy. The humble object is a thin shim that only does the untestable part.

**Smell:** A controller 400 lines deep mixing HTTP parsing, validation, business logic, and DB calls. A React component holding application state machines.

**Fix:** Extract a presenter or use case that takes plain data in and returns plain data out. Leave only the I/O thunk in the humble object.

---

## Main Component

**Rule:** `main` (or equivalent composition root) is the dirtiest class in the system — it knows every concrete type. Nothing else should.

**Smell:** Dependency wiring scattered across modules. Factories inside business logic. Singletons accessed via global imports.

**Fix:** Compose everything at startup in one place. Pass dependencies down explicitly. No service locators in the domain.

---

## Testability as a Structural Property

**Rule:** If your architecture is right, unit tests for business rules are fast, deterministic, and require zero infrastructure.

**Smell:** Tests need Docker, network, or a real browser to assert a business invariant.

**Fix:** Move the invariant into an entity or use case. Mock the port at the boundary.

---

## Review posture for plans

- The plan is reviewable architecture if it names **layers, boundaries, and dependencies**. If it only lists files and libraries, it's a task list, not an architecture.
- **Pick one structural violation at a time.** Multiple blocks overwhelm.
- **Cite the plan section.** Ungrounded blocks are noise.
- **Fix must be concrete and structural** — "move persistence behind a `UserRepository` port owned by the use case layer" beats "decouple from the DB".
- **When uncertain, ALLOW.** A plan is a hypothesis, not a final design. Block only on clear Dependency Rule violations or missing boundaries at critical seams.

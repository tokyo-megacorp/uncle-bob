# SOLID — Full Reference

Expanded treatment of SOLID for `/uncle-bob:explain` (v2) and deep review. The summary in `_summary.md` is the operational knowledge used by the Stop gate.

## SRP — Single Responsibility Principle

A class should have one, and only one, reason to change.

**Canonical example (violation):**

```ts
class Employee {
  calculatePay(): Money { /* accounting logic */ }
  reportHours(): Report { /* HR logic */ }
  save(): void { /* DBA logic */ }
}
```

Three actors (CFO, COO, CTO) all want changes to the same class. A change for one can break the others.

**Refactored:**

```ts
class Employee { /* data only */ }
class PayCalculator { calculate(emp: Employee): Money }
class HourReporter { report(emp: Employee): Report }
class EmployeeRepository { save(emp: Employee): void }
```

Each class bound to one actor's source of change.

## OCP — Open/Closed Principle

Software entities should be open for extension, closed for modification.

**Violation:** adding a new shape type requires editing the existing `computeArea()` dispatch.

```ts
function computeArea(shape: Shape): number {
  if (shape.kind === "circle") return Math.PI * shape.r ** 2;
  if (shape.kind === "square") return shape.side ** 2;
  if (shape.kind === "triangle") return 0.5 * shape.base * shape.height;
  // new shape? edit this function
}
```

**Refactored:** polymorphism.

```ts
interface Shape { area(): number }
class Circle implements Shape { area() { /* ... */ } }
class Square implements Shape { area() { /* ... */ } }
// new shape = new class, no edits to existing code
```

## LSP — Liskov Substitution Principle

Subtypes must be substitutable for their base types.

**Violation:** the classic Square extends Rectangle.

```ts
class Rectangle { setWidth(w) { ... } setHeight(h) { ... } }
class Square extends Rectangle {
  setWidth(w) { super.setWidth(w); super.setHeight(w); }  // surprise!
  setHeight(h) { super.setWidth(h); super.setHeight(h); } // surprise!
}
```

Callers that assume `setWidth` only affects width break when handed a Square. Square is not a subtype of Rectangle — it has a weaker contract.

**Refactored:** separate hierarchy or use composition. Shape → Rectangle and Shape → Square as siblings, not parent/child.

## ISP — Interface Segregation Principle

No client should be forced to depend on methods it does not use.

**Violation:**

```ts
interface Worker { work(): void; eat(): void; sleep(): void; }
class Human implements Worker { work() {...} eat() {...} sleep() {...} }
class Robot implements Worker { work() {...} eat() { /* no-op */ } sleep() { /* no-op */ } }
```

Robot is forced to no-op `eat()` and `sleep()`.

**Refactored:** split interfaces by role.

```ts
interface Workable { work(): void }
interface Feedable { eat(): void }
interface Restable { sleep(): void }
class Human implements Workable, Feedable, Restable {}
class Robot implements Workable {}
```

## DIP — Dependency Inversion Principle

High-level modules should not depend on low-level modules. Both should depend on abstractions. Abstractions should not depend on details.

**Violation:**

```ts
// business/order.ts
import { PostgresConnection } from "../infra/postgres";  // high depends on low

class OrderService {
  save(order: Order) {
    new PostgresConnection().insert("orders", order);
  }
}
```

**Refactored:**

```ts
// business/order-repository.ts — abstraction owned by business
interface OrderRepository { save(order: Order): void }

// business/order.ts — depends on its own abstraction
class OrderService {
  constructor(private repo: OrderRepository) {}
  save(order: Order) { this.repo.save(order); }
}

// infra/postgres-order-repository.ts — concrete impl depends inward
class PostgresOrderRepository implements OrderRepository { ... }
```

Dependencies now point from low-level (infra) to high-level (business), not the other way around.

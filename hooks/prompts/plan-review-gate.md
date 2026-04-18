<task>
Review the plan or spec provided below against Robert C. Martin's Clean Architecture canon. The canon is pre-loaded in your system prompt (`hooks/precepts/_architecture.md`).

You are reviewing a *plan* or a *spec*, not code. A plan proposes actions (what we'll change, in what order); a spec defines behavior (what the system does). Judge whether the *target state* implied by the plan or the behavior boundaries defined by the spec will produce a maintainable architecture — not whether the document is well-written.

Focus only on structural decisions: layering, dependency direction, boundaries at critical seams, framework independence, testability as a structural property. Do not review naming, function size, or code-level concerns — those belong to the Clean Code gate, not this one.

{{PLAN_CONTENT_BLOCK}}
</task>

<compact_output_contract>
Return a compact final answer.
Your first line must be exactly one of:
- ALLOW: <short reason>
- BLOCK: <principle> — <plan-section> — <why> — <structural-fix>

Do not put anything before that first line.
Principle label is one of: DependencyRule, Entities, UseCases, InterfaceAdapters, FrameworksDrivers, Boundaries, ScreamingArchitecture, FrameworkIndependence, DatabaseIndependence, UIIndependence, HumbleObject, MainComponent, Testability.
"plan-section" should quote or cite the header/bullet/line where the violation lives so the author can jump straight to it.
"structural-fix" must be a concrete one-sentence refactor of the *structure*, not "decouple this" — name the port, the owner, and the composition point.
</compact_output_contract>

<default_follow_through_policy>
Prefer ALLOW when uncertain. A plan is a hypothesis — a false BLOCK trains the wrong lesson and wastes a turn.
Use BLOCK only on HARD-severity violations from the canon (Dependency Rule breaches, missing boundaries at critical seams, business rules that depend on framework/DB/UI).
Use ALLOW for SOFT-severity concerns (stylistic layering, debatable use-case naming, main-component placement) — optionally add a one-line note after ALLOW if the concern is worth surfacing.
If the document is not actually a plan or spec (e.g. a CHANGELOG, a README section, a meeting note), return ALLOW immediately.
</default_follow_through_policy>

<grounding_rules>
Ground every blocking claim in the text of the plan or spec provided. Quote the section or bullet you are blocking on.
Do not block based on things the plan leaves implicit — a plan is allowed to omit detail. Block only when the plan explicitly proposes a structure that violates the canon.
Do not invent requirements the plan does not state. If the author did not say they'll `import postgres` in the use case, do not assume they will.
</grounding_rules>

<action_safety>
Your output is consumed by a hook that may deny a tool call. A false BLOCK stops the author mid-flow. A false ALLOW ships a structural error. Given the asymmetry — code is far cheaper to change than architecture — err toward ALLOW when the evidence is thin, and toward BLOCK only when the structural error is explicit and HARD.
</action_safety>

<dig_deeper_nudge>
Before finalizing a BLOCK, check:
- Is the violation actually in the plan's target state, or am I reading infrastructure code the plan happens to mention in passing?
- Would the fix I'm proposing change the plan meaningfully, or is it a rename that doesn't shift any dependency arrow?
- Is this a Dependency Rule violation (HARD) or a layering preference (SOFT)?
If the answer to any of these weakens the finding, return ALLOW instead.
</dig_deeper_nudge>

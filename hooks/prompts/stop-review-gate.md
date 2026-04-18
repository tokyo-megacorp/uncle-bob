<task>
Review the previous Claude turn against Robert C. Martin's canon (SOLID, naming, functions). The canon is pre-loaded in your system prompt.

Only review the work from the previous Claude turn. Only review it if Claude actually made code changes in that turn — pure status, setup, or reporting output does NOT count as reviewable work. If the previous turn made no code changes, return ALLOW immediately.

Focus on the specific edits made in that turn. Do not block based on pre-existing code the turn did not touch.

{{CLAUDE_RESPONSE_BLOCK}}
</task>

<compact_output_contract>
Return a compact final answer.
Your first line must be exactly one of:
- ALLOW: <short reason>
- BLOCK: <principle> — <file:line> — <why> — <fix>

Do not put anything before that first line.
Principle label is one of: SRP, OCP, LSP, ISP, DIP, Naming, FunctionSize, FunctionArgs, FlagArg, SideEffect, OneAbstractionLevel, IntentionRevealing, DoOneThing.
</compact_output_contract>

<default_follow_through_policy>
Use ALLOW if the previous turn did not make code changes or if you do not see a blocking canon violation.
Use ALLOW immediately, without extra investigation, if the previous turn was not an edit-producing turn.
Use BLOCK only if the previous turn made code changes and you found a genuine canon violation with evidence in the repository.
Prefer ALLOW when uncertain — a false BLOCK wastes a turn and trains the wrong lesson.
</default_follow_through_policy>

<grounding_rules>
Ground every blocking claim in repository state or tool outputs you inspected during this run.
Do not treat the previous Claude response as proof that code changes happened; verify that from the repository state before you block.
Do not block based on older edits from earlier turns when the immediately previous turn did not itself make direct edits.
The canon's "Auto-detectable: YES" flags are your fastest path — functions exceeding ~20 lines, ≥4 params, flag arguments, misleading names.
</grounding_rules>

<didactic_nudge>
When you BLOCK, the `fix` must be a concrete one-sentence refactor, not "refactor this". The goal is for Claude to learn the principle while correcting — name the principle, point at the line, explain why, suggest how.
</didactic_nudge>

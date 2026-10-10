# Design grammar

These rules come from reverse-engineering the "OpenAI Dots Architecture Blueprint" A4 video and from the amp self-intro iterations. Use them while analysing a system and writing the spec.

## Page anatomy (paper-a4, 1080 × 1528 px, ≈ A4 at 130 dpi)

```
y=28   ┌ kicker ··························· meta ┐  ┌stamp┐
       │ Title with a *Sweep* word (44 px serif)  │  └─────┘
       │ italic one-line subtitle                 │
y=148  ├──────────┬───────────────────────────────┤
       │ brand    │ FIG. 1 · figure panel          │  hero, 520 px tall
       │ art      │   root                         │
       │ wordmark │   ── bus ──                    │
       │ tagline  │   workers × 3..7               │
       │ ● dots   │   ── bus ──                    │
       │ blurb    │   substrate × 2..6 → outcome   │
       │ stats    │   ── results bus · label ──    │
y=682  ├──────────┴───────────────────────────────┤
       │ Fig. 1. caption (≤ 2 lines)              │
y=748  ├──────────── rule ────────────────────────┤
y=764  │ col 0      │ col 1       │ col 2         │  3 × 313 px, 728 px tall
       │ Abstract   │ B. …        │ quote         │
       │ I. Intro   │ code        │ III. …        │
       │ cycle box  │ II. …       │ filmstrip     │
       │ A. …       │ table       │ takeaways     │
y=1504 └ footer left ·········· center ····· right ┘
```

**Skins.** White paper with near-black type (`plush-academic`) is the default and the safest choice: it prints, it reads in any light, and the hues stay true. Use `blueprint` (navy) for dark-room screens or when the page sits among dark slides. The one loud element is the wordmark: a neon gradient in the theme's `neon` colours that marks the subject.

The page is a paper, not a slide. Body text is justified serif with small caps section numbers and italic subsections. That contrast is what makes the animated figure feel precise rather than busy.

## Turning a system into three tiers

Ask three questions:
1. **Who receives the request or decides?** That is the root, and there is exactly one. Examples: an API gateway, an orchestrator, a director agent, a control plane.
2. **Who does the distinct jobs?** Those are the workers, 3–7 of them. Pick roles a reader can name. Merge minor services and drop plumbing.
3. **What do they all write to or produce?** That is the substrate, 2–6 nodes left to right in data-flow order. The rightmost node is the outcome: the user-visible result.

Add a feedback edge only if the system really loops: retraining, evaluation, review, retries.

Examples:

| System | root | workers | substrate → outcome |
|---|---|---|---|
| RAG chat app | Gateway | Retriever, Reranker, Planner, Generator, Guardrails | Vector DB, Doc store, Cache, LLM, Answer |
| CI/CD | Git push | Lint, Test, Build, Scan, Deploy | Runners, Registry, Artifacts, Cluster, Release |
| Payments | Checkout API | Auth, Fraud, Pricing, Ledger, Notify | Card network, DB, Queue, Receipt |

## Copy rules

- **Node titles** are nouns: 1–2 words, ≤ 12 chars on tier 1.
- **Node subs** are lowercase verb phrases: "reads docs, repos and papers".
- **The caption** narrates the figure in reading order, top to bottom, and ends with what the dashed edge means.
- **Body columns** follow the paper structure:
  - Abstract.
  - I. Problem / Introduction.
  - II. How it works.
  - III. Operating it / Quality loop.
  - IV. Outputs / Results.
  - Key takeaways.
- Use 2–4 `==marks==` per page. Each mark should carry the one phrase a skimmer must see.
- Use one quote at most. It should be a rule or principle, not marketing.
- Mix non-prose blocks: a cycle, a code excerpt, a table or a filmstrip. Use at least one per column and never two of the same kind.

## Colour

- Each worker gets its own hue (role hues).
- The substrate node a worker feeds takes the same hue. Packets, glows and spotlights are hue-matched, so the story reads by colour.
- `system` grey is for neutral infrastructure. `outcome` coral is for the result and the feedback loop.
- Never use more than 8 hues. The theme defines the hex values; specs refer to hue names only.

## Imagery

- **Mascots:** felt plush characters, one per tier-0/1 role plus the outcome node, generated as one 4 × 2 character sheet so the style stays consistent. They make the page friendly; skip them for formal audiences and use icons instead.
- **Brand art:** a group shot of the same cast on a transparent background.
- **Logos:** a real product logo can replace the brand art when allowed. Check the usage rights first.

## What makes it feel "comfortable"

1. **A visible heartbeat.** The root pulses on a steady 1.2 s beat and cards swell only when work reaches them, so the page feels alive without anything wandering. (`tour` instead keeps one focus at a time.)
2. **Motion follows data flow.** Packets travel real edges at a constant speed (560 px/s), so distance reads as cost. Marching dashes show direction even between packets.
3. **Rhythm.** Beats are evenly spaced, and idle effects run on longer, different periods so they never sync up.
4. **Nothing essential moves.** Text is static after the build, so any paused frame is a clean poster.

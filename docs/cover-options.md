# Cover options — Agentic AI Solutions deck

## Why we are changing it

The cover of `public/presentations/agentic-ai-solutions.html` currently reads:

> **Agentic AI that works**
> _while you sleep_
>
> Autonomous AI agents that operate independently, learn continuously and deliver results — without
> constant supervision.

Customer feedback on this line was a trust concern, not a benefit: _"what will they do whilst I'm
not watching… could do something bad"_. The headline invites the prospect to picture software
acting unobserved, and "without constant supervision" in the subtitle confirms the fear rather than
answering it.

The five options below all keep the real benefit — the work carries on continuously — but reframe
the autonomy as **controlled and accountable**: guardrails, human sign-off, an audit trail, you
stay in charge. Each keeps the existing visual pattern: a plain first line, then an italic lime
accent line.

Nothing here has been applied to the deck. Pick one (or a hybrid) and we will implement it.

---

## Option 1 — Under your control

**Headline**

> Agentic AI that works
> _under your control_

**Subtitle**

> AI agents that keep the work moving around the clock — inside the limits you set, with every
> action logged and reversible.

**Angle** — The smallest possible edit: it keeps the familiar "Agentic AI that works" opener and
swaps only the half that triggers the anxiety, so control is asserted in the same breath as the
autonomy.

---

## Option 2 — Autonomous where it helps

**Headline**

> Autonomous where it helps
> _supervised where it matters_

**Subtitle**

> Agents run the routine work continuously and stop for a human on the decisions you have said need
> one.

**Angle** — Names the boundary out loud, so autonomy reads as a deliberate design decision about
which work is safe to hand over, rather than an absence of oversight.

---

## Option 3 — Always accountable

**Headline**

> Always working
> _always accountable_

**Subtitle**

> AI agents that carry the work forward day and night, and leave a full audit trail of what they
> did and why.

**Angle** — Answers the customer's actual question head-on: you can always see exactly what
happened while you were not watching, because the record is part of the product.

---

## Option 4 — Delegate the work, keep the decisions

**Headline**

> Delegate the work
> _keep the decisions_

**Subtitle**

> AI agents take the routine work off your team continuously, while every judgement call stays with
> a named human.

**Angle** — Frames it as delegation, a management idea every buyer already trusts, instead of as
handing over control to something they cannot see.

---

## Option 5 — Overnight progress, morning sign-off

**Headline**

> The work moves overnight
> _you sign it off in the morning_

**Subtitle**

> Agents progress the work while your team is offline, then hand back a clear summary to review,
> approve or roll back.

**Angle** — Keeps the vivid overnight benefit of the original but ends on a human checkpoint, so
the prospect pictures a report waiting for them rather than something running unwatched.

---

## Where it gets applied

`public/presentations/agentic-ai-solutions.html`, slide 1:

```html
<h1>First line<br /><em>italic accent line</em></h1>
<p class="lead">Subtitle.</p>
```

The `<em>` is what renders italic and lime. Em dashes in the deck are written as `&mdash;`.
Options 3, 4 and 5 also change the shape of the first line, so re-run
`node scripts/verify-presentations.mjs` after editing to confirm the longer headline still fits the
frame.

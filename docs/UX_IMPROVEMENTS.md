# PostPigeon Dashboard — UX Improvements

## The Core Problem

The dashboard is built around the *data model* (posts, jobs, platforms) rather than around *what a user wants to do*. Every page feels like a database view. There are also ghost pages — `Bank.jsx` and `Queue.jsx` exist but are not routed anywhere — two systems coexisting without a clear owner.

---

## 1. Navigation — Rename and Restructure

**Current:**
```
Overview
  Content
    Posts
    Scheduled
    Platforms
  Operations
    Settings
```

**Proposed:**
```
[+ Compose]      ← primary action button, top of sidebar, always visible

  Overview       ← keep, but fix what's inside it
  Library        ← renamed from "Posts" — it's your content backlog
  Queue          ← renamed from "Scheduled" — what's going out and when
  Activity       ← renamed — what's already been sent (history)

  Settings       ← absorbs Platforms (platform toggle moves here)
```

**Rationale:** Users think in terms of *Compose → Queue → Sent*, not *Posts → Scheduled*. "Platforms" doesn't deserve its own sidebar link — it's a settings concern. Moving it inside Settings collapses the nav to the 4 things that matter.

---

## 2. Dashboard (Overview) — Stop Linking to the Editor

**Bug:** `JobRow` contains a `<Link to={/posts/${job.post_id}}>` where the link text is the raw internal ID (e.g. `post-1741234567890`). Clicking any job takes you to the full PostEditor. The ID string is meaningless.

**What it should do:**
- Show the post **title** or first few chars of tweet text — enrich the job data when loading, or do a follow-up fetch for titles
- Cards are **read-only status cards**, not edit links
- Only action allowed on Overview: "Retry" on failed jobs, nothing else
- Add a **"today's pace" stat**: `3 / 10 posted today` progress bar — the most useful thing a scheduler can show
- Remove the Platforms widget from the bottom of Overview — it adds noise

---

## 3. Queue Page (was: Scheduled) — Inline Actions, No Editor

**Bug:** Each row has `<Link to={/posts/${job.post_id}}>` showing the raw post ID as link text.

**Inline actions per job state:**

| Job state | Allowed actions |
|-----------|----------------|
| `pending`  | **Cancel** inline (already exists but is too small/easy to miss) |
| `failed`   | **Retry** inline — currently impossible without going to the editor |
| `posted`   | **View tweet** link (`https://x.com/i/status/{tweet_id}`) if tweet_id is stored |

**Layout changes:**
- Group jobs **by date** — not by status tabs; date grouping makes it feel like a calendar queue
- Status filter tabs can be kept but date headers should be the primary organiser
- Show **content preview** (first 80 chars of tweet text) in each row — not the post ID

---

## 4. Thread Composition — The Biggest UX Gap

The current `ThreadBuilder` is functional but doesn't *feel* like writing a thread.

**Problems:**
- Numbered textareas with drag handles look like a form, not a conversation
- No visual connection between tweets (the blue vertical line that Twitter uses)
- "Tweet 1 of 3" label is redundant — the number badge already conveys this
- Char counter is cut off in source code
- No way to promote the first tweet to a reply

**Proposed thread composer model** (à la Typefully):
```
  │   [ Tweet 1 text ───────────────── ] 240/280
  │   [ + image ]
  │
  │   [ Tweet 2 text ───────────────── ] 0/280
  │
       [ + Add to thread ]
```

- Left vertical line connects all tweets visually (left border on each tweet card)
- Avatar/dot on top-left of each tweet (static grey circle)
- First tweet has no number; subsequent tweets show `2/`, `3/` etc
- "Add to thread" lives at the bottom, not in the header
- Drag handles stay but only visible on hover

---

## 5. Reply / "Comment on Tweet" UX

**Current:**
```
Replying to tweet ID
[ input: e.g. 1234567890123456789 ]
```

Users don't know tweet IDs. They copy tweet URLs.

**Fix:**
- Accept a full tweet URL (`https://x.com/user/status/12345`)
- Parse the ID from the URL client-side with a regex
- Show `Replying to @user` if the username can be extracted from the URL
- Label it **"Reply to tweet"** not "Replying to tweet ID" — more action-oriented

**Also:** A thread starting from a reply is valid (reply to someone's tweet, then continue the chain). Currently `reply` is a separate type from `thread`. These should be unified — a reply can have multiple follow-up tweets (making it a thread reply chain).

---

## 6. PostEditor — Structural Issues

| Issue | Current | Fix |
|-------|---------|-----|
| Post title field | Labelled "Post title…" | Style as `Internal label (not posted)` — users will write titles like they're writing tweets |
| Type selector | Radio: standalone / thread / reply | Infer type from content: start single-tweet, `+ Add tweet` turns it into thread, `Replying to…` collapse adds a parent tweet |
| Random window mode | `09:00–21:00` inputs | Label as `Post within my active hours (9am–9pm)` |
| Save state feedback | Checkmark disappears after 2.5s | Keep "Saved" as a persistent pill badge on the title bar until navigation |

---

## 7. Ghost Pages — Bank.jsx / Queue.jsx

`Bank.jsx` and `Queue.jsx` exist in `dashboard/src/pages/` but are not in `App.jsx` routing. They use a completely different API (`api.getBank()`, `api.getQueue()`, `api.getPosted()`, `api.getState()`) — the original content-bank import flow where posts were bulk-imported from files.

**Decision needed:** Are these dead or alive?
- If the Posts system **replaces** Bank → delete these files
- If both flows coexist (bank-imported auto-posts + manually composed posts) → surface them properly in the UI with a clear mental model for which is which

---

## Recommended Execution Order

Highest impact per effort first:

1. **[ ~30 min ] Fix broken links** — remove `/posts/:id` links from Dashboard `JobRow` and Queue rows; show post title instead of raw ID
2. **[ ~15 min ] Rename navigation** — Posts → Library, Scheduled → Queue, move Platforms under Settings
3. **[ ~2 hrs ] Queue page** — add Retry action for failed jobs, group rows by date, show content preview
4. **[ ~3 hrs ] Redesign ThreadBuilder** — visual thread connector line, "Add to thread" at bottom, infer type
5. **[ ~1 hr ] Reply UX** — accept tweet URLs, parse ID client-side, show `@user` context
6. **[ ~3 hrs ] PostEditor type flow** — infer type from content, fix title label, improve random window label
7. **[ architect decision ] Resolve Bank.jsx ghost pages** — decide and clean up

---

## Why Each Change Solves a Real User Problem

### 1. Navigation rename → matches mental model

**User problem:** A user thinks "I want to see what's going out tomorrow" — they look for "Queue" or "Scheduled" and find "Posts". They look for their sent history and find "Scheduled" (which also contains posted jobs). Nothing matches what they're trying to do.

**Design fix:** Labels match the *task*, not the data type. "Library" = where I store content I've written. "Queue" = what's lined up to go out. "Activity" = what already went. This is the same pattern Notion, Linear, and Buffer use — verbs and nouns that match user intent.

---

### 2. Removing editor links from Dashboard/Queue rows → removes wrong-context navigation

**User problem:** On the Overview, a user sees a job row and clicks it expecting to see details about *that send event* (when did it post, which platform, did it succeed). Instead they land in the PostEditor — a completely different context — looking at the raw draft. They don't know how they got there or how to get back.

**Design fix:** Information architecture principle — *where you are should match what you clicked*. A job row is about a delivery event, so clicking it should show delivery details (status, time, platform, tweet link), not open the content editor. Read-only context cards stay in their domain.

---

### 3. Queue inline actions (Retry, Cancel, View tweet) → reduces round trips

**User problem:** A post failed. The user sees it on the Queue page but there's no Retry button. They have to click the post ID link → land in PostEditor → figure out how to re-trigger posting → come back. 3–4 steps for something that should be one click.

**Design fix:** Actions live where the data lives. This is the principle of *contextual controls* — if you can see the status, you should be able to act on it from the same place. Shopify, GitHub, and Linear all put primary row actions inline rather than behind a detail page.

---

### 4. Thread composer with visual connector → writing feels natural

**User problem:** The current ThreadBuilder looks like a numbered form. Writing a thread is a *creative, conversational* act — it should feel like composing a conversation, not filling out rows in a table.

**Design fix:** The vertical connector line (used by Twitter, Typefully, Tweetdeck) gives spatial context — you can *see* the thread as a chain of connected thoughts. Removing the redundant "Tweet 1 of 3" label reduces visual noise. "Add to thread" at the bottom follows reading gravity — you read top to bottom, so the next action is at the bottom. These are all applications of *progressive disclosure* and *spatial metaphor*.

---

### 5. Reply UX accepting URLs → removes impossible task

**User problem:** The current input says "enter tweet ID e.g. 1234567890123456789". No normal user knows or can easily find a tweet's numeric ID. The workflow to do this is: open Twitter → find the tweet → view page source or use developer tools → extract the ID. This is a developer task, not a user task.

**Design fix:** Accept what users *actually have* (the URL they copied from their browser) and extract the ID for them. This is the principle of *meeting users at their level of knowledge*. The user knows the tweet URL. The system knows how to parse it. The system should do that work, not the user.

---

### 6. Inferring post type vs. selecting it → removes a decision that shouldn't exist

**User problem:** When creating a new post the first decision is "choose type: standalone / thread / reply". The user just wants to write. They don't know if what they're writing will become a thread until they've started. Forcing the choice upfront means they often pick wrong and have to restart.

**Design fix:** Start in single-tweet mode. If the user clicks "+ Add tweet", it becomes a thread. If they click "Replying to…", it becomes a reply. The *type is inferred from actions*, not declared upfront. This matches how people actually write — the form follows the content, not the other way around. Gmail does this: you start composing and reply threading just happens contextually.

---

### 7. Resolving ghost pages → removes hidden complexity

**User problem:** Hidden complexity is the worst kind because users may stumble into it through old URLs, or developers build on top of two conflicting systems, or bugs silently exist in unrouted pages. The Bank and Queue pages have real API connections to real data that is never surfaced.

**Design fix:** Either remove dead code (if genuinely unused) or intentionally surface it with a clear position in the IA. Hidden complexity violates the principle of *least surprise* — the system should behave consistently with what it shows.

---

## The Overarching Design Principle

All of these issues share one root cause: **the UI was built page-by-page to expose backend entities** (posts, jobs, platforms, bank items) rather than designed around **user workflows** (write → schedule → monitor → react to failures).

Good dashboard design starts with: *what are the 3–5 things a user does every day, and how many clicks does each take?* For PostPigeon those are:

1. **Write a new post** — should be 1 click from anywhere
2. **Check what's going out today** — should be visible on Overview without clicking anything
3. **Retry a failed post** — should be 1 click from Queue
4. **See what posted and open the live tweet** — 1 click from Activity

Currently none of these are 1 click. The improvements target exactly that gap.

# Co-op (Ch.3, Multiplayer)

Several investigators share one mystery. Everything about the mystery is
shared — the decks, the clue sets, the danger track, the clock — and everything
about a person is their own: attributes, fatigue, strikes, keywords,
obligations, experience.

## Who is in the party
Make a new investigator, or bring in one you already play — as long as they are
not in the middle of a mystery of their own. They come across as they stand:
fatigue, strikes, keywords, obligations and experience. The app copies them, so
the original stays in its own career (ruling A21).

## Whose scene is it
- An **investigation** or **truth** scene is played by the whole party.
- Any **other** scene is taken separately: each investigator plays their own
  rest or obligation for that segment, one scene each.
- The clock is marked **once everybody has had a scene**, and then it advances
  for all of them at once. The day turns when every clock is full, and each
  investigator answers for their own neglected obligations.

## Sharing the narration
In a scene everyone is in, each investigator should get something to do — a test
that moves a stage along, or a piece of the fiction to describe. The app's "Who
acts?" chooser says who has and has not acted this scene. In a scene only one
investigator is in, the others play the people around it.

## Threats
- A threat attaches to whoever caused the consequences roll that brought it. When
  nobody did — a threat that comes with the investigation roll — the players say
  whose way it is in.
- When it acts, its consequences land on the investigator it is attached to.
- Acting against it attaches it to you instead.

## Consequences
The co-op table replaces the solo one: danger rises by **3** rather than 1 when
no threat is present, and a discard result discards **two** cards. The rest of
the table is unchanged.

*Engine:* `store.party` and `setActive`, `lifecycle.startRound`,
`recordRoundScene`, `pendingInvestigators`, `roundComplete`, `endScene`,
`applyDayBoundary`, `roller.attachedTo`, `roller.attributeTest({actorId})`,
`rules.consequenceRow(total, multiplayer)`.

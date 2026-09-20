// Wires the engine's player decisions to real UI. Installed once at boot.

import { el, add } from "./core.js";
import { chooseModal, promptModal, modal, showToast } from "./ui.js";
import { setPrompts } from "./roller.js";
import { cardName } from "./deck.js";
import { Settings } from "./settings.js";

export function installPrompts() {
  setPrompts({
    async pickFalseLead(sets) {
      const choice = await chooseModal({
        title: "A joker — one lead was never real",
        message: "Choose the clue set that turns out to be circumstantial. Its cards are discarded and that rank can never become a truth.",
        allowCancel: false,
        options: sets.map((s) => ({
          value: s,
          label: `${s.rank}s · ${s.cards.length} card${s.cards.length === 1 ? "" : "s"}`,
          note: s.description || "no description yet",
        })),
      });
      return choice || sets[0];
    },

    async pickStrike(options) {
      const choice = await chooseModal({
        title: "The track is full",
        message: "Strike your highest unstruck attribute. Two are tied — choose which gives out.",
        allowCancel: false,
        options: options.map((a) => ({ value: a, label: `${a.name} ${a.value}`, note: a.text })),
      });
      return choice || options[0];
    },

    async describeClue({ set, card, oracle, clue, isNew }) {
      if (!Settings.get("autoOracle")) {
        return await promptModal({
          title: isNew ? `New clue — ${set.rank}s` : `The ${set.rank}s get clearer`,
          message: `${cardName(card)} drawn.`,
          placeholder: "What does your investigator find?",
          multiline: true,
        });
      }
      return await promptModal({
        title: isNew ? `New clue — the ${set.rank}s` : `The ${set.rank}s get clearer`,
        message: `${cardName(card)} drawn. Prompts: ${clue} — ${oracle}. Write what this is, or leave it blank for now.`,
        placeholder: isNew ? "e.g. invoice found at the butcher shop" : "e.g. one of the doors is taped shut",
        multiline: true,
      });
    },

    async describeKeyword({ suggestion, oracle }) {
      return await promptModal({
        title: "You come away with something",
        message: `Prompts: ${suggestion} — ${oracle}. Name the keyword in your own words, or keep the prompt.`,
        value: suggestion,
        confirmLabel: "Keep it",
      });
    },

    async randomEvent({ words }) {
      await new Promise((resolve) => {
        modal({
          title: "Doubles — something else happens",
          body: el("div", {},
            el("p", { class: "muted", text: "A random event cuts into the scene. It changes no numbers by itself: read it, and let it change what your investigator or the threats do next." }),
            el("p", { class: "mono", text: words.join("  ·  ") })),
          actions: [{ label: "Play it", onClick: () => resolve(true) }],
          onClose: () => resolve(true),
        });
      });
    },

    note: (text) => showToast(text),
  });
}

/** One place that turns an engine event into a sentence a player can read. */
export function eventText(e) {
  switch (e.t) {
    case "test": return `${e.label || "Test"}: ${e.dice.join(" + ")}${e.attrValue ? ` + ${e.attrValue}` : ""} = ${e.total}`;
    case "consequence": return `Consequence ${e.die}${e.bonus ? ` + ${e.bonus}` : ""} = ${e.total}. ${e.text}`;
    case "threat_acts": return `${e.name} acts (${e.die} + ${e.level} = ${e.total}). ${e.text}`;
    case "threat_in": return `Threat: ${e.name} arrives at level ${e.level}${e.cause ? ` from ${e.cause}` : ""}.`;
    case "threat_up": return `${e.name} rises to level ${e.level}.`;
    case "threat_capped": return `${e.name} is already level 3.`;
    case "threat_marked": return `${e.name} marked ${e.marks}/${e.level}.`;
    case "threat_removed": return `${e.name} is out of the scene${e.via === "keyword" ? " — a keyword handled it" : ""}.`;
    case "rival_returns": return `A rival returns: ${e.name} (1d6 ${e.roll}, slot ${e.slot}).`;
    case "rival_defeated": return `${e.name} is off your rival list.`;
    case "danger": return `Danger ${e.note === "halved" ? "halved to" : "now"} ${e.value}.`;
    case "fatigue": return `Fatigue ${e.value}/5.`;
    case "attribute_struck": return `${e.attribute} is struck until you rest.`;
    case "all_struck": return "Every attribute is already struck.";
    case "force_escape": return "The track filled — skip to the escape stage.";
    case "keyword_gained": return `Keyword gained: ${e.text}.`;
    case "keyword_used": return `Keyword struck: ${e.text} (${e.action}).`;
    case "new_clue": return `New clue: the ${e.set.rank}s (${cardName(e.card)}).`;
    case "strengthen_clue": return `The ${e.set.rank}s get clearer (${cardName(e.card)}).`;
    case "false_lead": return `False lead: the ${e.rank}s were never part of this. ${e.cards} card(s) discarded.`;
    case "joker_no_sets": return `No lead to lose — danger doubles to ${e.danger}.`;
    case "joker_removed": return "The joker leaves the game.";
    case "discard_false_lead": return `${cardName(e.card)} means nothing now — discarded, no replacement.`;
    case "discard_established_truth": return `${cardName(e.card)} adds nothing to a settled truth — discarded, draw again.`;
    case "discarded": return `${cardName(e.card)} discarded from the clue deck.`;
    case "deck_empty": return "The clue deck is empty.";
    case "game_over": return e.trigger === "deck_empty" ? "The clue deck is empty — it is time to resolve the mystery." : "Your investigator cannot continue — resolve the mystery.";
    case "random_event": return `Random event: ${e.words.join(" · ")}`;
    case "stage": return `Stage: ${e.stage}${e.forced ? " (forced)" : ""}.`;
    case "scene_end": return "The scene ends.";
    case "clock": return `Clock ${e.value}/4.`;
    case "investigation_roll": return `Investigation roll ${e.die} + ${e.danger} danger = ${e.total}. ${e.text}`;
    case "rest": return `Rest 1d6 = ${e.die}: ${e.cleared} fatigue cleared.`;
    case "attributes_cleared": return `Attribute strikes cleared: ${e.attributes.join(", ")}.`;
    case "signature_cleared": return `Signature keyword recharged.`;
    case "obligation_attended": return `Obligation attended: ${e.text}.`;
    case "day_end": return e.neglected.length ? `Day over. Neglected: ${e.neglected.join(", ")}.` : "Day over. Every obligation was attended.";
    case "day_start": return `Day ${e.day} begins.`;
    case "threats_left": return `Left behind: ${e.names.join(", ")}.`;
    case "reroll": return "A keyword buys the roll again.";
    default: return null;
  }
}

export function eventList(events) {
  const ul = el("ul", { class: "events" });
  for (const e of events) {
    const text = eventText(e);
    if (text) add(ul, el("li", { text }));
  }
  return ul.children.length ? ul : null;
}

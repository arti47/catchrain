// A first session, step by step: what to tap and why the game asks for it.

import { el, add } from "./core.js";
import { section, btn, explain } from "./ui.js";
import { go } from "./router.js";

const STEPS = [
  ["Make your investigator", [
    "Case → Create an investigator. Spread 2, 1 and 0 across Power, Insight and Method: the 2 is what they reach for first.",
    "Take one obligation. It is not decoration — any day you do not attend it costs you a fatigue, and fatigue is what eventually strikes out your best attribute.",
    "Your signature keyword is your reusable favour. Everything else you pick up is one-use.",
  ]],
  ["Set up the mystery", [
    "Roll a location, an object and a treachery. The sentence they make is the whole premise; you are not meant to know what it means yet.",
    "Pick a motivation. When you are unsure what your investigator would do next, that is the line to read again.",
    "The app shuffles 42 clue cards and twelve face cards, and sets three face cards aside. Those three are the answer.",
  ]],
  ["Set every scene, then play it", [
    "Each scene opens with two questions at the top of the screen: where is this taking place, and who is here and what are they doing. Answer them in a line or two before you roll anything.",
    "Then add what the rules have put in the scene \u2014 the threat that came with the investigation roll, the stage you are in, how high danger has climbed.",
    "Stuck? A closed question goes to the yes/no oracle; an open one takes two or three words from the subject oracles and you read them as an answer. Both are on the buttons right there.",
    "What you write drops into the journal, which exports as plain text. Writing is only one way to keep the record: draw it, say it out loud, or keep it in your head \u2014 the book is happy with any of them.",
  ]],

  ["Play an investigation scene", [
    "Play → Investigation scene. The app rolls 1d6 and adds your danger: a high total means something is already in your way.",
    "Each stage is one test. Choose the attribute that fits what you are actually doing in the fiction, not the biggest number.",
    "7–9 still succeeds — it just costs. Read the consequence out loud and let it change the scene before you roll again.",
  ]],
  ["Take a clue and describe it", [
    "Clearing the acquisition stage draws a card. A new rank starts a clue set; a repeat makes an existing one stronger.",
    "The app offers a table word and two or three oracle words. They are prompts, not answers: write a sentence you would recognise later.",
    "If a joker turns up, one of your leads was never real. Pick the one you are least attached to — and know it can never become a truth.",
  ]],
  ["Deal with a threat", [
    "A threat rolls on the consequences table after every test you do not act against it, adding its level. Ignoring a level 3 threat is how runs end.",
    "Acting against it is just a test. 10+ marks it twice. Or spend a keyword and it is simply gone.",
    "Once a threat is present you cannot leave until you clear the escape stage.",
  ]],
  ["End the scene and the day", [
    "Play → End the scene marks the clock. Four marks and the day turns over: neglected obligations bite, strikes clear, and a random event opens the new day.",
    "Between scenes, rest when the fatigue track is climbing and attend an obligation before the day runs out. Both cost you a clue card from the deck — there is no free time.",
  ]],
  ["Establish a truth", [
    "Play → Truth scene. Turning a clue set sideways reveals as many face cards as it has cards, and those cards are ruled out for good.",
    "It also makes that set joker-proof. A two-card set revealed early is worth more than a perfect description.",
  ]],
  ["Playing it with other people", [
    "Settings → Co-op turns the career into a party: several investigators, one mystery, one clock and one danger track. Fatigue, keywords, obligations and experience stay personal.",
    "An investigation or truth scene is played by everybody; anything else is taken separately, and the clock only moves once each of you has had a scene. The app hands the spotlight to whoever is still owed one.",
    "Threats stick to whoever brought them down on themselves, and their rolls land on that person until somebody else acts against it.",
    "In a scene you are not in, play the people around it: the person on the other end of the obligation, the voice in the doorway.",
  ]],

  ["Name the truth", [
    "When the deck runs out, a consequence forces you out, or you decide you have enough, go to the solve.",
    "Guess all three cards, then turn them over. Every correct guess buys one answer about what really happened — and whatever you write is true.",
    "Nothing correct is a real ending too: the rain, and a case you never closed.",
  ]],
];

export function renderTutorial(host) {
  add(host, el("h1", { text: "Your first session" }),
    explain("A walkthrough of one whole session, in the order you will play it. It is a screen, not a pop-up — come back to it mid-game whenever you are unsure what the app wants next."));
  add(host, section("You do not have to read this",
    el("p", { text: "The line at the top of every screen already says what to do next and what it will cost you, and the Why? beside it explains the moment you are in. This page is here for when you want the whole shape of a session at once." })));
  const wrap = el("div", {});
  STEPS.forEach(([title, paras], i) => {
    const det = el("details", { class: "acc", open: i === 0 ? true : null });
    add(det, el("summary", { text: `${i + 1}. ${title}` }),
      el("div", { class: "acc-body" }, ...paras.map((p) => el("p", { class: "small", text: p }))));
    add(wrap, det);
  });
  add(host, wrap);
  add(host, section("When you are ready",
    el("div", { class: "btn-row" },
      btn("Create an investigator", () => go("wizard"), "primary"),
      btn("Read the rules library", () => go("rules")))));
  return {};
}

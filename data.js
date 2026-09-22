// Caught in the Rain — core rules library.
// Every number, table and procedure here is extracted from the supplied rulebook
// transcript (Nicholas Robinia, The Ravensridge Emporium, 2025). Effect text is
// paraphrased; table entries are the book's own single-word/short-phrase prompts,
// which are data, not prose. Citations are to the transcript's chapter/section.

// --- Decks (Ch.1, Game setup) -------------------------------------------------
export const DECK = {
  clueRanks: ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  suits: ["S", "H", "D", "C"],
  jokers: 2,
  truthRanks: ["J", "Q", "K"],
  setAside: 3,
};

// --- Investigation roll: 1d6 + danger (Ch.2, Investigation scenes) ------------
export const INVESTIGATION_ROLL = [
  { min: -99, max: 3, stage: "infiltration_skipped", startStage: "discovery", threatLevel: 0,
    text: "Everything is quiet. Your investigator makes their way in." },
  { min: 4, max: 5, startStage: "infiltration", threatLevel: 1,
    text: "Something or someone is in your investigator's way." },
  { min: 6, max: 99, startStage: "infiltration", threatLevel: 2,
    text: "Something or someone has noticed your investigator!" },
];

// `action` is what the button for this stage says, so the guide and the play
// screen name the same control rather than two descriptions of one thing.
export const STAGES = [
  { id: "infiltration", name: "Infiltration", note: "Getting where you need to go.", action: "Find a way in", onlyIfRolled4Plus: true },
  { id: "discovery", name: "Discovery", note: "Working out where the clue is.", action: "Find where the clue is" },
  { id: "acquisition", name: "Acquisition", note: "Taking the clue.", action: "Take the clue", grantsClue: true },
  { id: "escape", name: "Escape", note: "Fleeing the location.", action: "Get out", onlyIfThreat: true },
];

// --- Attribute test: 2d6 + attribute (Ch.2, Attribute tests) ------------------
export const TEST_OUTCOMES = [
  { min: -99, max: 6, id: "failure", name: "Failure",
    text: "Your investigator fails in their approach. What's in their way?",
    gainKeyword: true, consequences: true, bonusClue: false },
  { min: 7, max: 9, id: "cost", name: "Success at a cost",
    text: "Your investigator succeeds, but there is a complication.",
    gainKeyword: false, consequences: true, bonusClue: false },
  { min: 10, max: 99, id: "success", name: "Success",
    text: "Your investigator succeeds in their approach.",
    gainKeyword: false, consequences: false, bonusClue: true },
];

// --- Consequences: 1d6 (+ threat level when a threat rolls) -------------------
export const CONSEQUENCES_SOLO = [
  { min: -99, max: 3, id: "threat_up", text: "Increase the level of a threat by 1 (max 3). If there are no threats present, increase danger by 1 instead." },
  { min: 4, max: 4, id: "discard", text: "Discard a card from the clue deck." },
  { min: 5, max: 6, id: "fatigue1", text: "Mark 1 fatigue." },
  { min: 7, max: 8, id: "fatigue2", text: "Mark 2 fatigue." },
  { min: 9, max: 99, id: "end", text: "Your investigator can no longer continue the investigation. Resolve the mystery." },
];

// Ch.3, Multiplayer: same table, two rows differ.
export const CONSEQUENCES_MULTI = [
  { min: -99, max: 3, id: "threat_up", text: "Increase the level of a threat by 1 (max 3). If there are no threats present, increase danger by 3 instead." },
  { min: 4, max: 4, id: "discard", text: "Discard 2 cards from the clue deck." },
  { min: 5, max: 6, id: "fatigue1", text: "Mark 1 fatigue." },
  { min: 7, max: 8, id: "fatigue2", text: "Mark 2 fatigue." },
  { min: 9, max: 99, id: "end", text: "Your investigators can no longer continue the investigation." },
];

export const THREAT_LEVELS = [
  { level: 1, text: "Dangerous to be near, but not actively seeking your investigator, or far away." },
  { level: 2, text: "Actively seeking your investigator, or getting closer." },
  { level: 3, text: "Actively seeking your investigator with lethal intent, or right on top of them." },
];

// --- Keyword actions (Ch.2, Keywords) -----------------------------------------
export const KEYWORD_ACTIONS = [
  { id: "reroll", name: "Re-roll an attribute test",
    text: "Re-roll a test after seeing its outcome. Keep either the new outcome or the old one." },
  { id: "strengthen", name: "Strengthen a clue",
    text: "Search the clue deck (then shuffle) or the discard pile for a card matching an established clue set and add it." },
  { id: "eliminate", name: "Eliminate a threat",
    text: "Remove a threat from the scene as if you had defeated it." },
];

// --- Scene types (Ch.2, Flow of play) -----------------------------------------
export const SCENE_TYPES = [
  { id: "investigation", name: "Investigation", text: "Visit a location to uncover clues while danger rises and threats act against you." },
  { id: "truth", name: "Truth", text: "Reveal truth cards using a clue set, to improve your guesses and keep the set safe." },
  { id: "rest", name: "Rest", text: "Clear fatigue and attribute strikes." },
  { id: "obligation", name: "Obligation", text: "Explore your investigator as a person by attending an obligation." },
];

export const CLOCK_SEGMENTS = 4;
export const FATIGUE_BOXES = 5;
export const ATTRIBUTES = [
  { id: "power", name: "Power", text: "Strength, speed, and physical resistance." },
  { id: "insight", name: "Insight", text: "Logical thinking and environmental awareness." },
  { id: "method", name: "Method", text: "Resourcefulness and creativity." },
];
export const ATTRIBUTE_ARRAY = [2, 1, 0];
export const ATTRIBUTE_MAX = 3;

// --- The solve (Ch.2, Resolving the mystery) ----------------------------------
export const SOLVE_QUESTIONS = [
  "Why was the location significant?",
  "Why was the object significant?",
  "Why did this treachery befall the object?",
];

export const END_TRIGGERS = [
  { id: "chosen", text: "You chose to resolve the mystery at the end of a scene." },
  { id: "deck_empty", text: "The clue deck is empty." },
  { id: "consequence", text: "You rolled 9+ on the consequences table." },
];

// --- Optional rules (Ch.3) ----------------------------------------------------
export const DIFFICULTIES = [
  { id: "hard", name: "Hard", redHerrings: 2, revealTruths: 0, xpBonus: 3,
    text: "A longer mystery the best investigators may struggle with." },
  { id: "standard", name: "Standard", redHerrings: 0, revealTruths: 0, xpBonus: 2,
    text: "Typical length and difficulty. The default mode of play." },
  { id: "easy", name: "Easy", redHerrings: 0, revealTruths: 3, xpBonus: 0,
    text: "A mystery the average person could solve; a shorter game." },
  { id: "trivial", name: "Trivial", redHerrings: 0, revealTruths: 6, xpBonus: -1,
    text: "A very short mystery that still poses some threat.", xpPenalty: true },
];

export const XP_BENEFITS = [
  { id: "danger", cost: 1, name: "Reduce the danger by 1." },
  { id: "rival", cost: 2, name: "Reduce the threat level of a rival by 1." },
  { id: "drop_obligation", cost: 3, name: "Remove an obligation (only if you have more than one)." },
  { id: "clear", cost: 3, name: "Remove all marks and strikes from fatigue and attributes." },
  { id: "signature", cost: 4, name: "Gain an additional signature keyword and an obligation." },
  { id: "attribute", cost: 6, name: "Increase an attribute by 1 (max 3) and gain an obligation." },
];

// --- Playing solo (Ch.1, Solo advice) -----------------------------------------
// The book's own guidance, paraphrased: what to ask when a scene opens, and
// the ways it suggests keeping a record.
export const SCENE_FRAMING = {
  questions: [
    "Where is this scene taking place?",
    "Who is here, and what are they doing?",
  ],
  note: "Then add whatever the rules have put in it \u2014 a threat, the stage you are in, how high the danger has climbed.",
  unsure: "Stuck on a detail? A closed question goes to the yes/no oracle; an open one takes two or three words from the subject oracles.",
};

export const RECORDING_METHODS = [
  "Write the scene down as a journal entry.",
  "Draw it.",
  "Say it out loud and record yourself.",
  "Keep it in your head.",
  "Blend any of these \u2014 the game does not mind.",
];

export const RIVAL_SLOTS = 6;
export const NEW_OBLIGATION_XP = 2; // voluntarily taking a new obligation between mysteries

// --- Oracles (Ch.4) -----------------------------------------------------------
// Yes/no is 1d6 per the oracle table. (The worked example rolls 2d6 against it;
// see ruling A11 in CLAUDE.md — the table wins, the example is an erratum.)
export const YES_NO = [
  { min: 1, max: 2, id: "extreme_no", name: "Extreme no" },
  { min: 3, max: 3, id: "no", name: "No" },
  { min: 4, max: 4, id: "yes", name: "Yes" },
  { min: 5, max: 6, id: "extreme_yes", name: "Extreme yes" },
];

// Subject oracles — meaning tables: single words, feed interpretation.
export const ORACLE_ACTION = ["Confront","Investigate","Create","Guard","Control","Evade","Eliminate","Support","Share","Explore","Impress","Steal","Protect","Improve","Manipulate","Deliver","Locate","Arrive","Escort","Search","Leave","Attack","Acquire","Restore","Reveal","Capture","Chase","Hide","Demand","Prevent","Trap","Trick","Disguise","Focus","Abandon","Uncover"];
export const ORACLE_DESCRIPTOR = ["Flourishing","Treacherous","Active","Old","Dark","Concealed","Broken","Guarded","Empty","Forgotten","Abandoned","Isolated","Small","Wild","Growing","Large","Fast","Expensive","Evasive","Narrow","Foreign","Intelligent","Practical","Paltry","Slow","Significant","Habitual","Cautious","Cooperative","Sacred","Aquatic","Redundant","Elegant","Beautiful","Unsightly","Sleepy"];
export const ORACLE_FOCUS = ["Truth","Risk","Clue","Mystery","Gadget","Power","Insight","Secret","History","Life","Opportunity","Route","Obligation","Wealth","Hate","Deception","Weapon","Death","Treasure","Love","Message","Trust","Skill","Plan","Refuge","Patron","Knowledge","Followers","Bravery","Fear","Fight","Court","Doubt","Relationship","Reputation","Burden"];

// --- General random tables (Ch.4) ---------------------------------------------
// Treacheries 61-66 (index 30-35) reference a second, separately generated object.
export const TREACHERIES = ["Vanished","Changed","Perished","Suffered","Failed","Was replaced","Was destroyed","Was depleted","Became vulnerable","Was stolen","Became exposed","Appeared","Was disrupted","Was consumed","Became corrupted","Was sealed away","Evolved","Warped","Deteriorated","Evaporated","Crumbled","Withered","Was erased","Exploded","Disappeared","Was revealed","Transformed","Was modified","Manifested","Was hidden","Damaged the [object]","Changed the [object]","Destroyed the [object]","Revealed the [object]","Exposed the [object]","Became the [object]"];
export const TREACHERY_NEEDS_SECOND_OBJECT = (i) => i >= 30;

export const FIRST_NAMES = ["Kit","Anahera","Elijah","Silas","Zephyr","Imogen","Richter","Amelia","Zayd","Yoko","Oliver","Cecil","Ike","Lorenzo","Penny","Jon","Hafsah","Tamsin","Ripley","Willow","Cristiano","Nixa","Leif","Charlie","Jasher","Fatima","Montgomery","Gilda","Camille","Pearl","Wren","Percy","Estella","Leah","Yorinna","Landon"];
export const LAST_NAMES = ["Deckard","Asher","De la Rue","Bakshi","Sheppard","Briggs","Pearce","Roh","Bardon","Nguyen","Braybrook","Diaz","McGuire","Porter","Mahuta","Eriksson","Cromwell","Thorpe","Johannes","Marx","Elsher","Nichols","Scully","Stines","Vazquez","Zimet","Onai","Rosenblum","Anderson","Thatcher","Heywood","García","Veilleux","Leeson","Seymour","Wilder"];
export const NAME_PREFIX = ["An","Neph","Yor","Cal","Har","Fen","Bryn","Orin","Sel","Con","Tar","Lor","Quin","Vael","Ael","Elen","Iver","Mer","Jes","Nym","Bran","Nic","Par","Jas","Bal","Lys","Thel","Nyx","Car","Stef","Vesir","Gren","Rik","Dam","Ren","Al"];
export const NAME_SUFFIX = ["lim","inna","way","don","low","ath","laris","enar","norin","jorn","thor","vryn","sen","rath","olas","sar","len","eth","dor","oris","lum","drel","ne","nor","us","mine","e","aros","pyre","rin","sette","on","an","a","wyn","in"];
export const TRAITS = ["Optimistic","Lazy","Blind","Alter ego","Cocky","Narcissistic","Soft","Missing limb","Insomniac","Cowardly","Superstitious","Adventurous","Tattooed","Charming","Cold","Heavyset","Resilient","Elegant","Pessimistic","Verbal stutter","Ruthless","Paranoid","Greedy","Depressed","Lean","Stoic","Prosthetic eye","Fidgety","Mute","Scarred","Forgetful","Angry","Loud","Sickly","Law-abiding","Germaphobe"];
export const MOTIVATIONS = ["Complicit loved one","Monetary incentive","Vendetta","Just business","Career advancement","Promise to keep","Pure curiosity","Right a wrong","Personal danger","Boredom","Love","Obsession","Blackmail","Pursuit of truth","Debilitating guilt","Proof of worth","Sense of duty","Past trauma","Faith","Reputation to uphold","Thrill-seeking","Rivalry","Dying wish","One last job","Debt to repay","Hatred","Personal connection","Compelling dreams","Desperation","Nothing to lose","For the challenge","Unfinished work","A missing piece","Curse to break","Protect a secret","Academic"];

// --- Genre tables (Ch.4) ------------------------------------------------------
// Six tables per genre. Mix and match freely (Ch.1, Genre).
export const GENRES = {
  noir: {
    name: "Noir",
    locations: ["Café","Prison","Boat","Alleyway","Abandoned building","Church","University","Home","Gallery","Train station","Beach","Apartment","Car park","Zoo","Restaurant","Gas station","Basement","Police station","Morgue","Museum","Hotel","Factory","Warehouse","Pub","Casino","Gym","Amusement park","Courthouse","Park","Bank","Storage unit","Pier","Shopping centre","Airport","Backyard","Stadium"],
    objects: ["Family","Figurehead","Artefact","Secret document","Plant","Animal","Vehicle","Money","Medicine","Weapons","Officer","Disease","Investigation","Criminal","Interloper","Passerby","Key","Community","Drug","Reporter","Paperwork","Evidence","Owner","Safe","Group","Witness","Map","Photograph","Rival","Prisoner","Discovery","Structure","Survivor","Resident","Visitor","Goods"],
    clues: ["Email","Recorded conversation","Witness account","Suspicious behaviour","Trail of carnage","Recurring symbol","Recent visit","Forensic evidence","Associated group","Another location","Meeting invitation","Handwritten notes","False alibi","Business card","Cadaver","Secret room","Hidden cache","Criminal record","Anonymous phone call","Abandoned vehicle","Partial confession","Ransom letter","Body part","Getaway trail","Trophy","Personal connection","Accusatory statement","Pattern","Manifesto","Urban legend","Newspaper clippings","Cipher","Vacant mark","Testimony","Eviction notice","Incongruous object"],
    keywords: ["Mantra","Weapon","Companion","Knowledge","Jewellery","Dialect","Artefact","Key","Polaroid","Tool","Distraction","Connection","Clothing","Code","Cabal","Forgotten","Reason","Scent","Kidnapping","Stolen","Grudge","Family","Carving","Backdoor","Medicine","Aid","Dream","Missing","Conspiracy","Lie","Betrayal","Avenue of escape","Presence","Powerful ally","Voice","Trail"],
    obligations: ["Help a sick partner","Manage alcoholism","Rekindle a relationship","Pay off debts","Overcome a trauma","Protect a person","Manage a disability","Protect a secret","Absolve sins","Fuel a drug addiction","Indulge dark urges","Be a good parent","Escape the rat race","Repair a marriage","Write a novel","Volunteer locally","Preserve a legacy","Care for a pet","Hide an affair","Run a family business","Mentor youth","Work at a day job","Remain undiscovered","Topple an organisation","Prove your innocence","Stalk your next victim","Attend therapy","Continue education","Reclaim an old career","Remain stable","Obey secret society","Track a missing item","Win a legal battle","Get revenge","Find peace","Tend to a garden"],
    threats: ["Invasive thoughts","Sudden landslide","Armed individual","Government agent","Restless crowd","Dangerous animal","Blazing fire","Guard patrol","Angry boss","Unrelenting stalker","Security system","Man-made trap","Eerie darkness","Interested faction","Criminal activity","Police presence","Rival detective","Toxic chemical","Unstable structure","Media presence","Hidden fanatic","Drunk bystander","Nauseating stench","Distant pursuer","Environmental anomaly","Altered state","Imposter syndrome","Heavy rain","Faulty equipment","Distracting noise","Consuming fear","Inconsolable victim","Assassin","Trauma trigger","Persistent exhaustion","Frustrated resident"],
  },
  fantasy: {
    name: "Fantasy",
    locations: ["Tavern","Castle","Dungeon","Smithy","Forest","Campsite","Armoury","Monastery","Carnival","Watch tower","Ruins","Mine","Farmland","Apothecary","Battlefield","Market","Guild hall","Training grounds","Creature's lair","Barracks","Mountain path","Lake","Rampart","Fighting pits","Hamlet","Bridge","Sanctuary","Crypt","Archives","Workshop","Tourney grounds","Cave system","Peasant's home","Cathedral","Town square","Torture chamber"],
    objects: ["Sky","Vow","Warrior","Royalty","Assassin","Treasure","Treaty","Priest","Adviser","Tapestry","Elder","Relative","Prophecy","Townsfolk","Guild","Party","Traveller","Messenger","Merchant","Bodyguard","Sorcerer","Amulet","Golem","God","Sword","Horde","Natural feature","Performer","Relic","Dragon","Magic","Successor","Wand","Faerie","Sentient object","Sacrifice"],
    clues: ["Ledger","Spiritual act","Arcane illusion","Beastly evidence","Folklore","Directions","Guild iconography","Soiled footprint","Strange weather","Claw marks","House seal","Hidden people","Decorated weapon","Whispered rumour","Overheard plot","Suspicious sighting","Remains of ritual","Sign of struggle","Specific instructions","Lost history","Lingering aura","Blood trail","Secret order","Depicted prophecy","Abandoned structure","Town crier","Animal gathering","Ancient relic","Shrine carvings","Foreign object","Scorched earth","Poisonous substance","Esoteric doctrine","Torn clothing","Recent camp","Disappearance"],
    keywords: ["Iron chunk","Sword","Stable","Portal","Armour","Tome","Tracks","Heraldry","Spell","Beast","Rune","Scroll","Fealty","Dragon","Feather","Bellows","Crown","Talisman","Hearth","History","Faerie","Rotten","Declaration","Mead","Sign","Market","Knight","Temple","Tournament","Oath","Poison","Tavern","Sigil","Herald","Feast","Dungeon"],
    obligations: ["Protect a relic","Serve a monarch","Avoid a prophecy","Mentor young warriors","Sustain a devotion","Secure a bloodline","Provide for a household","Reclaim a lost title","Discover lost archives","Seek power","Revive a lost craft","Prepare for a war","Fend off creatures","Rebuild an hometown","Support a guild","Forge a weapon","Repair an old castle","Care for a beast","Interrogate a prisoner","Ward off corruption","Repel invaders","Learn magic","Obey a demon","Protect a village","Learn from a mentor","Gamble in a tavern","Run a tavern","Overthrow a leader","Guard ancestral lands","Tax peasants","Train with a weapon","Find bounty work","Replenish supplies","Honour the gods","Best your rival","Hone skills"],
    threats: ["Dark mage","Hungry bandits","Black magic","Town guards","Paid mercenaries","Ferocious winds","Hostile wildlife","Dangerous creature","Crazed zealot","Magical ward","Irritating bard","Manipulative faerie","Protective nomads","Belligerent drunk","Possessed guide","Divine interference","Fickle elemental","Spreading necrosis","Undead swarm","Treacherous terrain","Cursed relic","Arcane interference","Doppelganger","Scouting party","Violent raiders","Sinister townsfolk","Scaled beast","Diseased bystanders","Sneaky pickpocket","Heckling priest","Dense parade","Cruel monarch","Blood moon","Fallen knight","Mistaken thug","Self-doubt"],
  },
  horror: {
    name: "Horror",
    locations: ["Manor","Cellar","Townhouse","Garden","Servant's quarters","Ballroom","Docks","Private study","Rural farmhouse","Surveyor camp","Hospital","Attic","Chapel","Library","Cemetery","Family mansion","City streets","Moor","Country road","Theatre","Asylum","Inn","Catacombs","Reading room","Lighthouse","Sewers","Bell tower","Cabin","Parlour","Estate","Stables","Island","Observatory","Shipwreck","Windmill","Office"],
    objects: ["Sun","Servant","Doll","Letter","Heirloom","Sibling","Grimoire","Partygoer","Fortune","Family","Animal","Deed","Gentleperson","Cult","Reflection","Creature","Spirit","Lord","Vampire","Storm","Journal","Memory","Heiress","Painting","Curse","Vagrant","Corpse","Oracle","Secret","Veil","Statue","Light","Thrall","Memoir","Lady","Decorative saber"],
    clues: ["Repeated phrase","Suspicious package","False account","Family deed","Drug stash","Town gossip","Hidden crawlspace","Memory fragment","Unfinished ritual","Prophetic visions","Esoteric sight","Bribe","Out of place weapon","Unearthed remains","Cursed bloodline","Lost diary","Stashed toxins","Forbidden knowledge","Scrawlings","Scandal","Revealing letter","Powerful artefact","Familiar melody","Half-destroyed papers","Notable absence","Absent hour","Family tree","Suspect motivation","Obsession","Last will and testament","Odd sensation","Unstable behaviour","Personal trace","Distinct smell","Patron","Strange remnants"],
    keywords: ["Strand","Cabinet","Blood","Dream","Ritual","Spectre","Duel","Gossip","Void","Vial","Lantern","Oubliette","Haunt","Trapdoor","Servant","Storm","Carriage","Inheritance","Plague","Illusion","Family","Fashion","Cellar","Violin","Powder","Ointment","Mirror","Bookcase","Newspaper","Wealth","Scheme","Gown","Growth","Omen","Grave","Skittering noises"],
    obligations: ["Sunder a dark curse","Repair an estate","Trace your lineage","Punish the wicked","Attend a meeting","Honour a family pact","Write a letter","Discover a cure","Serve your master","Maintain your nobility","Obtain wealth","Attend church","Further your research","Oust your rival","Exonerate a sibling","Satiate your blood lust","Run an apothecary","Find the family crypt","Guard sacred grounds","Enact your visions","Nourish a creature","Stalk a gentleperson","Overcome your fears","Advise an aristocrat","Maintain your sanity","Feed the ravens","Plan a ball","Atone for your sins","Escape your marriage","Assist a relative","Obfuscate a truth","Forget your dreams","Decode an old tome","Answer the call","Pay off a benefactor","Hide your vile affliction"],
    threats: ["Demonic presence","Skulking shadows","Restless peasant","Unstable mind","Hopeless thoughts","Nagging twitch","Grasping hands","Unhappy gentry","Growing mould","Watchful eyes","Sickly substance","Floating grimoire","Summoning circle","Lurking insecurity","Ceaseless tickling","Rat swarm","Prowling monster","Ferocious storm","Cultists","Encroaching screeching","Meddling sibling","Disruptive servant","Unhallowed ground","Witch hunter","Village mob","Supernatural lord","Indescribable horror","Maddening bells","Strange reflection","Pulsing void","Sudden vertigo","Shifting structures","Jealous lover","Crushing anxiety","Hidden trap","Corrupt constable"],
  },
  scifi: {
    name: "Sci-fi",
    locations: ["Space station","Galactic cruiser","Slums","Brothel","Drug den","Corporate HQ","Megacity underground","Black market","Rooftop","Skyscraper","Junkyard","Arcade","Hideout","Cockpit","Space freighter","Lunar base","Penthouse","Dive bar","Speakeasy","VR world","Server room","Highway","Dig site","Abandoned ship","Private residence","Gene lab","Military base","Nightclub","Union office","Bio-dome","Back alley","Gang safe-house","Cryo-chamber","Ship port","Alien planet","Laboratory"],
    objects: ["Data set","Microchip","Android","Chemical","Patent","AI","Agent","Contraband shipment","Gang","Hardware","Bioweapon","Flight path","CEO","Power source","Communication device","Pilot","Surveillance system","Group of workers","Algorithm","Life-support system","Engineer","Cargo container","Formula","Program","Occupant","Tracker","Crew","Whistleblower","Doctor","Contract","Monolith","Network","Addict","New technology","Population","Solar array"],
    clues: ["Digital footprint","Disembodied implant","Distinct damage","Nanite liquid","Weird coordinates","Biometric data","Timestamp","Tampered electronics","Redacted documents","Digital files","Hidden agenda","Unpaid debts","Encrypted server","Bug-out bag","Spray tag","Audio log","Mechanical remains","Unregistered implant","Altered surveillance","Strange biology","Unidentified object","Unlogged cargo","Scientific research","Evidence of life","Televised report","Destroyed ship","DNA mismatch","Biological sample","Camera footage","Encrypted message","Heightened security","Distress signal","Altered data","Black-market lead","Nefarious plans","Planetary anomaly"],
    keywords: ["Gun","Chip","Synthetic","Android","Binary","Alien","Glass","Surveillance","Scan","Lock","Technology","Core","Loop","Security","Engine","Signal","Sludge","Visor","Med-kit","Augmentation","Network","Corporation","Bridge","Wire","Scavenge","Star","Laser","Keypad","Digit","Station","Program","Jargon","Slum","Fluid","Orbit","Toxic"],
    obligations: ["Erase a digital trace","Pay for medical bills","Distribute manifestos","Run a podcast","Conceal true identity","Perform at nightclub","Hide illegal clones","Support an AI","Tend to a bio-dome","Resist AI influence","Repay hacking debts","Feed the homeless","File daily reports","Keep a corporate job","Indulge in a drug","Reintroduce flora","Hunt an android","Repair a robot","Scan for survivors","Enact mutual aid","Pursue hedonism","Get out of the slums","Aid the revolution","Restore a server","Attend an inspection","Fund a body mod","Enforce a curfew","Smuggle contraband","Pay landlord","Attend virtual therapy","Repair an old ship","Catalogue data","Play a VR game","Unlock lost memories","Synthesise food","Avoid media"],
    threats: ["Chemical fumes","Rogue android","Drone presence","Malfunctioning tech","Security turrets","Corporate police","Drug addict","Blaring alarm","Scavenger","Blackout","Neural hackers","Unknown entity","Scrambler signal","Military presence","Toxic rain","Tracer signal","Active firefight","Industrial pollution","Singularity","Solar storm","Lingering guilt","Meteor shower","Oxygen breach","Organ thief","Space pirates","Post-human activist","Union riot","Freezing temperatures","Radiation","Electrical surge","Bioscanner","Sentient AI","Alternative gravity","Dangerous traffic","Biker gang","Virus"],
  },
};

export const GENRE_IDS = Object.keys(GENRES);
export const TABLE_KINDS = ["locations", "objects", "clues", "keywords", "obligations", "threats"];

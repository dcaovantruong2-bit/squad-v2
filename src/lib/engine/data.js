/**
 * SQUAD — Game Data v2 (Svelte ES module)
 * Audit fixes applied:
 *   - 53 players (3 new journeyman additions)
 *   - Updated CHIPS_FORMULA (GK+PAS, CDM PAS*3, CM SPC, LW/RW/ST SPC, ST atk*2)
 *   - 4-4-2 fixed (LW+RW added), formations cleaned (no global/bonuses)
 *   - Synergy values boosted 3-4x, trio redesigned CDM+CM+CM
 *   - ES module exports
 */

export const PLAYERS = [
  { id:"terry_henri", name:"Terry Henri", position:"ST", atk:9, pac:9, pas:6, def_:1, spc:8, traits:["pacey","clinical"], description:"The clinical speedster." },
  { id:"big_zlat", name:"Big Zlat", position:"ST", atk:8, pac:5, pas:7, def_:2, spc:10, traits:["physical","technical"], description:"Acrobatic target man." },
  { id:"kun_kun", name:"El Caníbal", position:"ST", atk:8, pac:8, pas:5, def_:1, spc:7, traits:["pacey","poacher"], description:"Low center of gravity." },
  { id:"the_waz", name:"The Waz", position:"ST", atk:8, pac:6, pas:7, def_:5, spc:6, traits:["physical","leader"], description:"Bulldog forward." },
  { id:"flash_forward", name:"Theo Walk-not", position:"ST", atk:5, pac:7, pas:2, def_:1, spc:3, traits:["pacey","poacher"], description:"All pace." },
  { id:"lewan_goalski", name:"Lewan-goal-ski", position:"ST", atk:9, pac:5, pas:2, def_:1, spc:5, traits:["poacher","clinical"], description:"Six-yard box." },
  { id:"rob_cutter", name:"Arjen Cutback", position:"RW", atk:8, pac:9, pas:6, def_:1, spc:8, traits:["pacey","clinical"], description:"Cut inside." },
  { id:"rabona_ron", name:"El Shaa-ra-wrong", position:"RW", atk:5, pac:6, pas:5, def_:1, spc:6, traits:["pacey","clinical","journeyman"], description:"Fancy flicks." },
  { id:"riyad_mahrizzle", name:"Riyad Mah-rizzle", position:"RW", atk:7, pac:7, pas:8, def_:2, spc:9, traits:["technical","playmaker"], description:"Silky dribbler." },
  { id:"bale_out", name:"Bale Out", position:"LW", atk:8, pac:10, pas:6, def_:3, spc:7, traits:["pacey","physical"], description:"Pace AND power." },
  { id:"kylian_express", name:"Dictator Kylian", position:"LW", atk:7, pac:10, pas:5, def_:2, spc:7, traits:["pacey","clinical"], description:"Lightning." },
  { id:"cult_carl", name:"Wilfried Za-ha-ha", position:"LW", atk:5, pac:7, pas:5, def_:2, spc:3, traits:["pacey","clinical"], description:"Fans love him." },
  { id:"maestro_xav", name:"The Puppet Master", position:"CM", atk:3, pac:4, pas:10, def_:6, spc:7, traits:["playmaker","technical"], description:"Pulls the strings." },
  { id:"don_andres", name:"Don Andres", position:"CM", atk:6, pac:7, pas:9, def_:3, spc:10, traits:["technical","playmaker"], description:"Dribbling illusionist." },
  { id:"captain_stevie", name:"Captain Stevie", position:"CM", atk:8, pac:6, pas:8, def_:6, spc:8, traits:["leader","physical"], description:"Box-to-box." },
  { id:"jimmy_journey", name:"Park Ji-zoom", position:"CM", atk:3, pac:4, pas:7, def_:4, spc:2, traits:["physical","leader","journeyman"], description:"Does a job." },
  { id:"yaya_too_strong", name:"Yaya Too Strong", position:"CM", atk:4, pac:6, pas:5, def_:9, spc:4, traits:["destroyer","physical","leader"], description:"Towering." },
  { id:"el_mago", name:"Juan Maestro", position:"CAM", atk:6, pac:5, pas:10, def_:2, spc:9, traits:["technical","playmaker"], description:"Final third wizard." },
  { id:"mesut_assist", name:"Mesut Assist", position:"CAM", atk:6, pac:6, pas:9, def_:4, spc:7, traits:["playmaker","technical"], description:"Orchestrator." },
  { id:"bruno_penandes", name:"Bruno Penandes", position:"CAM", atk:8, pac:5, pas:8, def_:3, spc:10, traits:["playmaker","clinical"], description:"Stats monster." },
  { id:"wall_claude", name:"NGolo Kanteen", position:"CDM", atk:2, pac:4, pas:6, def_:10, spc:3, traits:["destroyer","technical"], description:"The destroyer." },
  { id:"frenkie_de_con", name:"Toni Cruise", position:"CDM", atk:4, pac:7, pas:10, def_:7, spc:7, traits:["technical","playmaker"], description:"Deep-lying conductor." },
  { id:"bog_bob", name:"Nigel de Wrong", position:"CDM", atk:2, pac:4, pas:5, def_:7, spc:2, traits:["destroyer","physical"], description:"Dirty work." },
  { id:"il_capitano", name:"El Capitan", position:"CB", atk:3, pac:6, pas:7, def_:10, spc:5, traits:["leader","technical"], description:"Elegant reader." },
  { id:"jt_rock", name:"Campbell-Soup", position:"CB", atk:4, pac:3, pas:4, def_:10, spc:4, traits:["physical","aerial"], description:"Eats attackers." },
  { id:"rolls_royce", name:"The Rolls Royce", position:"CB", atk:2, pac:8, pas:6, def_:9, spc:6, traits:["technical","leader"], description:"Composed." },
  { id:"old_man_dan", name:"Per Merterslower", position:"CB", atk:2, pac:2, pas:5, def_:8, spc:2, traits:["leader","aerial","journeyman"], description:"Reads the game." },
  { id:"el_tren", name:"Dani Elvis", position:"FB", atk:5, pac:9, pas:7, def_:7, spc:5, traits:["pacey","physical"], description:"Brazilian train." },
  { id:"mr_reliable", name:"Lahm-burger", position:"FB", atk:3, pac:7, pas:8, def_:9, spc:4, traits:["technical","leader"], description:"Two-footed." },
  { id:"cafu_express", name:"Kyle Jogger", position:"FB", atk:6, pac:10, pas:7, def_:6, spc:5, traits:["pacey","physical"], description:"Relentless." },
  { id:"the_crab", name:"The Tank", position:"FB", atk:2, pac:6, pas:4, def_:7, spc:1, traits:["destroyer","leader","journeyman"], description:"Tank." },
  { id:"no_look_dave", name:"Dave", position:"FB", atk:3, pac:8, pas:7, def_:8, spc:5, traits:["technical","playmaker"], description:"No-look Dave." },
  { id:"gigi_wall", name:"Gigi The Wall", position:"GK", atk:1, pac:2, pas:4, def_:10, spc:8, traits:["leader","aerial"], description:"The Wall." },
  { id:"saint_lloris", name:"Saint Lloris", position:"GK", atk:1, pac:2, pas:3, def_:10, spc:5, traits:["leader","aerial"], description:"Lightning reflexes." },
  { id:"rocket_raya", name:"Rocket Raya", position:"GK", atk:1, pac:5, pas:8, def_:6, spc:8, traits:["playmaker","technical"], description:"Sweeper keeper." },
  { id:"claudio_bravoops", name:"Claudio Bra-voops", position:"GK", atk:1, pac:5, pas:4, def_:7, spc:3, traits:["leader","technical"], description:"Solid shot-stopper." },
  { id:"virg_van_dyk", name:"Virg Van Dyk", position:"CB", atk:4, pac:8, pas:7, def_:10, spc:7, traits:["leader","technical","aerial"], description:"Colossus. Reads everything." },
  { id:"eddy_son", name:"Eddy-son", position:"GK", atk:1, pac:4, pas:9, def_:7, spc:8, traits:["playmaker","technical"], description:"Sweeper-keeper. Long balls." },
  { id:"rodri_go", name:"Rodri-go", position:"CDM", atk:3, pac:5, pas:9, def_:10, spc:6, traits:["technical","playmaker","leader"], description:"The metronome. Always in control." },
  { id:"haal_and_oates", name:"Haal-and-Oates", position:"ST", atk:10, pac:9, pas:3, def_:2, spc:8, traits:["pacey","physical","poacher"], description:"Freak of nature. You cant stop him." },
  { id:"lion_el_tidy", name:"Lion-el Tidy", position:"ST", atk:7, pac:7, pas:8, def_:2, spc:10, traits:["technical","playmaker","clinical"], description:"Drops deep. Orchestrates chaos." },
  { id:"zin_chenko", name:"Zin-chenko", position:"FB", atk:4, pac:7, pas:9, def_:6, spc:6, traits:["technical","playmaker"], description:"Steps into midfield. Quarterback." },
  { id:"kevin_de_brown", name:"Kevin De Brown", position:"CM", atk:7, pac:6, pas:10, def_:4, spc:8, traits:["playmaker","technical","clinical"], description:"The assist king. Let him talk." },
  { id:"casa_miro", name:"Casa-miro", position:"CDM", atk:2, pac:3, pas:5, def_:10, spc:3, traits:["destroyer","physical","aerial"], description:"The bouncer. Nothing gets past." },
  { id:"drog_baaaa", name:"Drog-baaaa", position:"ST", atk:9, pac:6, pas:5, def_:4, spc:9, traits:["physical","aerial","clinical"], description:"Hold-up play master. Big game player." },
  { id:"firm_inho", name:"Firm-inho", position:"ST", atk:6, pac:7, pas:7, def_:5, spc:8, traits:["clinical","technical"], description:"Presses from the front. Selfless." },
  { id:"sergio_ra_moose", name:"Sergio Ra-moose", position:"CB", atk:6, pac:5, pas:6, def_:9, spc:7, traits:["aerial","physical","leader"], description:"Attacking CB. Loves a header." },
  { id:"jude_bell_end", name:"Jude Bell-end", position:"CM", atk:8, pac:8, pas:7, def_:7, spc:8, traits:["physical","clinical","leader"], description:"Box-to-box engine. Does everything." },
  { id:"saka_potatoes", name:"Saka Potatoes", position:"RW", atk:7, pac:8, pas:8, def_:3, spc:9, traits:["technical","clinical","playmaker"], description:"Inverted winger. Cuts inside dangerously." },
  { id:"john_stones_soup", name:"John Stones-soup", position:"CB", atk:3, pac:7, pas:8, def_:8, spc:5, traits:["technical","leader"], description:"Steps into midfield. Composed." },
  { id:"theo_her_nandez", name:"The-o Her-nandez", position:"FB", atk:6, pac:10, pas:6, def_:7, spc:6, traits:["pacey","physical"], description:"Rocket down the left. Goal threat." },
  { id:"pippo_in_zag_me", name:"Pippo In-zag-me", position:"ST", atk:8, pac:6, pas:2, def_:1, spc:8, traits:["poacher","clinical","journeyman"], description:"Born offside. Scores anyway." },
  { id:"frank_lamp_post", name:"Frank Lamp-post", position:"CM", atk:8, pac:5, pas:7, def_:5, spc:8, traits:["clinical","physical"], description:"Late runs. Bullet shots." },
];

export const CHIPS_FORMULA = {
  GK:  function(p) { return Math.round(p.def_ * 2 + p.spc * 1 + p.pas * 1); },
  CB:  function(p) { return Math.round(p.def_ * 3 + p.pac * 1 + p.atk * 1); },
  FB:  function(p) { return Math.round(p.def_ * 2 + p.pac * 2 + p.pas * 1); },
  CDM: function(p) { return Math.round(p.def_ * 2 + p.pas * 3 + p.atk * 1); },
  CM:  function(p) { return Math.round(p.pas * 3 + p.atk * 1 + p.spc * 1); },
  CAM: function(p) { return Math.round(p.pas * 2 + p.atk * 2 + p.spc * 1); },
  LW:  function(p) { return Math.round(p.atk * 2 + p.pac * 2 + p.spc * 1); },
  RW:  function(p) { return Math.round(p.atk * 2 + p.pac * 2 + p.spc * 1); },
  ST:  function(p) { return Math.round(p.atk * 2 + p.pac * 2 + p.spc * 1); },
};

export const POSITION_ADJACENCY = {
  GK:  { natural:["GK"],  adjacent:[],                            different:["CB","FB","CDM","CM","CAM","LW","RW","ST"] },
  CB:  { natural:["CB"],  adjacent:["FB","CDM"],                  different:["CM","CAM","LW","RW","ST"] },
  FB:  { natural:["FB"],  adjacent:["CB","CDM","CM","LW","RW"],   different:["CAM","ST"] },
  CDM: { natural:["CDM"], adjacent:["CB","FB","CM","CAM"],        different:["LW","RW","ST"] },
  CM:  { natural:["CM"],  adjacent:["CDM","CAM","FB"],             different:["CB","LW","RW","ST"] },
  CAM: { natural:["CAM"], adjacent:["CM","ST","LW","RW"],         different:["CDM","CB","FB"] },
  LW:  { natural:["LW"],  adjacent:["RW","ST","CAM","FB"],        different:["CM","CDM","CB"] },
  RW:  { natural:["RW"],  adjacent:["LW","ST","CAM","FB"],        different:["CM","CDM","CB"] },
  ST:  { natural:["ST"],  adjacent:["LW","RW","CAM"],             different:["CM","CDM","CB","FB"] },
};

export const TRAIT_SLOT_FIT = {
  "pacey":     ["LW","RW","ST","FB"],
  "clinical":  ["LW","RW","ST","CAM"],
  "technical": ["CM","CAM","CDM","CB"],
  "playmaker": ["CM","CAM","LW","RW"],
  "physical":  ["ST","CB","CDM","FB","CM"],
  "destroyer": ["CDM","CB","CM"],
  "aerial":    ["CB","ST","GK"],
  "poacher":   ["ST","LW","RW"],
  "leader":    ["CB","CM","GK"],
};

export const FORMATIONS = [
  { id:"4-4-2", name:"4-4-2", handSize:11,
    slots:["CB","CB","FB","FB","CM","CM","LW","RW","ST","ST"],
    description:"Classic balance. Two banks of four. Solid in every phase.",
    synergyProfile:"Wingback Overlap, Organised Defence, Route One",
    pitchLayout:[
      { pos:"GK", x:50, y:95 },
      { pos:"FB", x:10, y:76 }, { pos:"CB", x:35, y:80 }, { pos:"CB", x:65, y:80 }, { pos:"FB", x:90, y:76 },
      { pos:"LW", x:8, y:42 }, { pos:"CM", x:37, y:48 }, { pos:"CM", x:63, y:48 }, { pos:"RW", x:92, y:42 },
      { pos:"ST", x:37, y:10 }, { pos:"ST", x:63, y:10 },
    ] },
  { id:"4-3-3", name:"4-3-3", handSize:11,
    slots:["CB","CB","FB","FB","CDM","CM","CM","LW","RW","ST"],
    description:"Attacking with width. CDM shields the back four.",
    synergyProfile:"Stretch Backline, Midfield Engine, Target Man Release",
    pitchLayout:[
      { pos:"GK", x:50, y:95 },
      { pos:"FB", x:10, y:76 }, { pos:"CB", x:35, y:80 }, { pos:"CB", x:65, y:80 }, { pos:"FB", x:90, y:76 },
      { pos:"CDM", x:50, y:60 }, { pos:"CM", x:30, y:44 }, { pos:"CM", x:70, y:44 },
      { pos:"LW", x:12, y:14 }, { pos:"ST", x:50, y:8 }, { pos:"RW", x:88, y:14 },
    ] },
  { id:"5-3-2", name:"5-3-2", handSize:11,
    slots:["CB","CB","CB","FB","FB","CM","CM","CDM","ST","ST"],
    description:"Defensive fortress. Three CBs lock it down.",
    synergyProfile:"Back Three, Organised Defence, Battering Ram, Double Pivot",
    pitchLayout:[
      { pos:"GK", x:50, y:95 },
      { pos:"FB", x:8, y:72 }, { pos:"CB", x:28, y:82 }, { pos:"CB", x:50, y:84 }, { pos:"CB", x:72, y:82 }, { pos:"FB", x:92, y:72 },
      { pos:"CDM", x:50, y:58 }, { pos:"CM", x:30, y:46 }, { pos:"CM", x:70, y:46 },
      { pos:"ST", x:37, y:10 }, { pos:"ST", x:63, y:10 },
    ] },
  { id:"3-4-3", name:"3-4-3", handSize:11,
    slots:["CB","CB","CB","FB","FB","CM","CM","LW","ST","RW"],
    description:"All-out attack. Three at the back, three up front.",
    synergyProfile:"Back Three, Stretch Backline, Target Man Release, Overlap",
    pitchLayout:[
      { pos:"GK", x:50, y:95 },
      { pos:"CB", x:26, y:80 }, { pos:"CB", x:50, y:84 }, { pos:"CB", x:74, y:80 },
      { pos:"FB", x:8, y:56 }, { pos:"CM", x:36, y:50 }, { pos:"CM", x:64, y:50 }, { pos:"FB", x:92, y:56 },
      { pos:"LW", x:12, y:14 }, { pos:"ST", x:50, y:8 }, { pos:"RW", x:88, y:14 },
    ] },
  { id:"4-2-3-1", name:"4-2-3-1", handSize:11,
    slots:["CB","CB","FB","FB","CDM","CM","CAM","LW","RW","ST"],
    description:"The complete system. CAM unlocks synergies no other formation can.",
    synergyProfile:"Near Post Flick, One-Two, Set Piece Threat, Wingback Overlap",
    pitchLayout:[
      { pos:"GK", x:50, y:95 },
      { pos:"FB", x:10, y:76 }, { pos:"CB", x:35, y:80 }, { pos:"CB", x:65, y:80 }, { pos:"FB", x:90, y:76 },
      { pos:"CDM", x:33, y:62 }, { pos:"CM", x:67, y:62 },
      { pos:"LW", x:10, y:32 }, { pos:"CAM", x:50, y:38 }, { pos:"RW", x:90, y:32 },
      { pos:"ST", x:50, y:8 },
    ] },
  { id:"4-5-1", name:"4-5-1", handSize:11,
    slots:["CB","CB","FB","FB","CDM","CM","CM","LW","RW","ST"],
    description:"Counter-attacking. Wide midfielders carry the ball forward.",
    synergyProfile:"Midfield Engine, Stretch Backline, Wingback Overlap",
    pitchLayout:[
      { pos:"GK", x:50, y:95 },
      { pos:"FB", x:10, y:76 }, { pos:"CB", x:35, y:80 }, { pos:"CB", x:65, y:80 }, { pos:"FB", x:90, y:76 },
      { pos:"LW", x:6, y:44 }, { pos:"CM", x:32, y:48 }, { pos:"CDM", x:50, y:58 }, { pos:"CM", x:68, y:48 }, { pos:"RW", x:94, y:44 },
      { pos:"ST", x:50, y:8 },
    ] },
];

export const ALL_PHASES = [
  { id:"goal_kick",       name:"Goal Kick",     tag:"Defensive",   weight:"DEF", slots:["GK","CB","CB"], desc:"Keeper launches long - defenders win the header" },
  { id:"build_up",        name:"Build-Up",      tag:"Possession",  weight:"PAS", slots:["FB","FB","CM"], desc:"Play out from the back - fullbacks into midfield" },
  { id:"wide_attack",     name:"Wide Attack",   tag:"Attacking",   weight:"PAC", slots:["FB","LW","RW"], desc:"Overload the flanks - fullback supports wingers" },
  { id:"direct_play",     name:"Direct Play",   tag:"Transition",  weight:"ATK", slots:[["LW","RW"],"ST","CM"], desc:"Quick transition - bypass midfield" },
  { id:"defensive_block", name:"Defensive Block", tag:"Defensive", weight:"DEF", slots:["CB","CB","CDM"], desc:"Compact defensive shape - protect the centre" },
  { id:"tiki_taka",       name:"Tiki-Taka",     tag:"Possession",  weight:"PAS", slots:["CM","CM","CAM"], desc:"Pass, move, repeat - creative midfield control" },
  { id:"counter",         name:"Counter",       tag:"Transition",  weight:"PAC", slots:["LW","ST","RW"], desc:"Explosive break - pacey attackers in behind" },
  { id:"set_piece",       name:"Set Piece",     tag:"Specialist",  weight:"SPC", slots:["CAM","CB","ST"], desc:"Dead ball specialist - aerial threat" },
];

export const SYNERGIES = [
  // === Position-pair synergies ===
  { id:"clean_sheet",         name:"Clean Sheet",       tag:"defensive",  trigger:{posA:"GK",posB:"CB",stat:"def_",threshold:20},   effect:{chips:50},   description:"GK DEF + CB DEF >= 18: +50 chips" },
  { id:"organised_defence",   name:"Organised Defence", tag:"defensive",  trigger:{positions:["CB","CB"],stat:"def_",threshold:20},  effect:{chips:50},   description:"2 CBs DEF >= 18: +50 chips" },
  { id:"wingback_overlap",    name:"Wingback Overlap",  tag:"attacking",  trigger:{posA:"FB",statA:"pac",posB:"CM",statB:"pas",threshold:17}, effect:{chips:70}, description:"FB PAC + CM PAS >= 15: +70 chips" },
  { id:"overload",            name:"Overload",          tag:"attacking",  trigger:{minDuplicates:2},                                  effect:{addMult:10}, description:"2+ same position: +15 mult each" },
  { id:"stretch_backline",    name:"Stretch Backline",  tag:"attacking",  trigger:{posA:"FB",statA:"pac",posB:"LW",statB:"pac",threshold:18}, effect:{xMult:1.25}, description:"FB PAC + LW PAC >= 17: x1.5 mult" },
  { id:"route_one",           name:"Route One",         tag:"transition", trigger:{posA:"CB",statA:"pas",posB:"ST",statB:"pac",threshold:16}, effect:{chips:70}, description:"CB PAS + ST PAC >= 14: +70 chips" },
  { id:"battering_ram",       name:"Battering Ram",     tag:"transition", trigger:{posA:"CB",statA:"def_",posB:"ST",statB:"atk",threshold:18}, effect:{chips:55}, description:"CB DEF + ST ATK >= 17: +55 chips" },
  { id:"defensive_duo",       name:"Defensive Duo",     tag:"defensive",  trigger:{stat:"def_",threshold:19},                         effect:{addMult:8}, description:"2 highest DEF >= 18: +10 add mult" },
  { id:"back_three",          name:"Back Three",        tag:"defensive",  trigger:{stat:"def_",threshold:8,count:3},                  effect:{xMult:1.2}, description:"All 3 DEF >= 7: x1.3 mult" },
  { id:"midfield_engine",     name:"Midfield Engine",   tag:"possession", trigger:{positions:["CM","CM"],statA:"pas",statB:"def_",threshold:17}, effect:{addMult:8}, description:"CM PAS + CM DEF >= 15: +10 add mult" },
  { id:"double_pivot",        name:"Double Pivot",      tag:"possession", trigger:{positions:["CM","CM"],stat:"pas",threshold:18},    effect:{carryover:25}, description:"2 CMs PAS >= 17: carryover +40 chips next phase" },
  { id:"covering_defender",   name:"Covering Defender", tag:"defensive",  trigger:{position:"CB",statA:"pac",thresholdA:7,statB:"def_",thresholdB:9}, effect:{addMult:8}, description:"Fast CB + strong CB: +10 add mult" },
  { id:"target_man_release",  name:"Target Man Release",tag:"attacking",  trigger:{posA:"ST",statA:"atk",wingerPos:["LW","RW"],statB:"pac",threshold:18}, effect:{xMult:1.3}, description:"ST ATK + winger PAC >= 17: x1.5 mult" },
  { id:"near_post_flick",     name:"Near Post Flick",   tag:"attacking",  trigger:{posA:"CAM",statA:"spc",posB:"ST",statB:"atk",threshold:17}, effect:{xMult:1.3}, description:"CAM SPC + ST ATK >= 16: x1.3 mult" },
  { id:"one_two",             name:"One-Two",           tag:"possession", trigger:{posA:"CM",statA:"pas",posB:"ST",statB:"pac",threshold:17}, effect:{xMult:1.35}, description:"CM PAS + ST PAC >= 15: x1.35 mult" },
  { id:"overlap",             name:"Overlap",           tag:"attacking",  trigger:{posA:"FB",statA:"pac",posB:"LW",statB:"pas",threshold:17}, effect:{xMult:1.3}, description:"FB PAC + LW PAS >= 15: x1.3 mult" },
  { id:"set_piece_threat",    name:"Set Piece Threat",  tag:"specialist", trigger:{statA:"def_",thresholdA:8,statB:"spc",thresholdB:8}, effect:{chips:25}, description:"DEF>=8 + SPC>=7: +35 chips" },
  { id:"trio",                name:"Trio",              tag:"possession", trigger:{positions:["CDM","CM","CM"],stat:"pas",threshold:8,count:3}, effect:{xMult:1.5}, description:"CDM + 2 CMs all PAS>=8: x1.5 - deep-lying control" },

  // === Persistent squad synergies (trait-count based) ===
  { id:"pace_in_behind",      name:"Pace in Behind",    persistent:true, trigger:{trait:"pacey",minCount:5},    effect:{playerMult:1.08,targetTrait:"pacey"},   description:"5+ pacey: all pacey x1.15 per phase" },
  { id:"iron_wall",           name:"Iron Wall",         persistent:true, trigger:{trait:"physical",minCount:3},  effect:{playerMult:1.12,targetTrait:"physical"}, description:"3+ physical: x1.2 mult" },
  { id:"leadership_council",  name:"Leadership Council",persistent:true, trigger:{trait:"leader",minCount:3},    effect:{addChips:10,target:"all"},              description:"3+ leaders: all get +15 chips per phase" },
  { id:"tiki_taka_persistent",name:"Tiki-Taka",         persistent:true, trigger:{trait:"technical",minCount:3}, effect:{positionMult:1.08,targetPositions:["CM","CDM","CAM"]}, description:"3+ technical: midfielders x1.15" },
  { id:"clinical_edge",       name:"Clinical Edge",     persistent:true, trigger:{trait:"clinical",minCount:2},  effect:{addChips:10,targetPositions:["LW","RW","ST"]}, description:"2+ clinical: attackers +15 chips" },
  { id:"double_destroyer",    name:"Double Destroyer",  persistent:true, trigger:{trait:"destroyer",minCount:2}, effect:{positionMult:1.12,targetPositions:["CB","FB","CDM"]}, description:"2+ destroyers: defenders x1.2" },
  { id:"two_up_top",          name:"Two Up Top",        persistent:true, trigger:{trait:"poacher",minCount:2},   effect:{positionMult:1.15,targetPositions:["ST"]}, description:"2+ poachers: STs x1.3" },
  { id:"playmaker_network",   name:"Playmaker Network", persistent:true, trigger:{trait:"playmaker",minCount:3}, effect:{positionMult:1.08,targetPositions:["CM","CAM","CDM"]}, description:"3+ playmakers: midfield x1.15" },
  { id:"aerial_fortress",     name:"Aerial Fortress",   persistent:true, trigger:{trait:"aerial",minCount:3},    effect:{positionMult:1.12,targetPositions:["ST","CB","GK"]}, description:"3+ aerial: ST/CB/GK x1.2" },
  { id:"pace_and_power",      name:"Pace & Power",      persistent:true, trigger:{traits:["pacey","physical"],minCount:3}, effect:{playerMult:1.15,targetTrait:"pacey"}, description:"2+ pacey+physical: x1.3" },
  { id:"silent_killers",      name:"Silent Killers",    persistent:true, trigger:{traits:["clinical","pacey"],minCount:3}, effect:{playerMult:1.15,targetTrait:"clinical"}, description:"2+ clinical+pacey: x1.25" },
  { id:"journeyman",          name:"Journeyman",        persistent:true, trigger:{trait:"journeyman",minCount:1}, effect:{special:"fatigue_reset"}, description:"Journeyman: once-per-match fatigue reset" },
];

export const COMBO_CHAINS = {
  "Defensive_Transition":    { effect:"xMult",            value:1.5,  desc:"Absorb pressure, hit on break - x1.5" },
  "Possession_Attacking":    { effect:"xMult",            value:1.3,  desc:"Patient build to incision - x1.3" },
  "Possession_Possession":   { effect:"addChips",         value:25,   desc:"Keep the ball - wear them down +25 chips" },
  "Transition_Transition":   { effect:"addChips",         value:35,   desc:"Rapid succession - +35 chips" },
  "Defensive_Defensive":     { effect:"fatigueRecovery",  value:0.1,  desc:"Rest while defending - fatigue recovery" },
  "Specialist_Any":          { effect:"addChips",         value:30,   desc:"Set piece leads to chance - +30 chips" },
  "Attacking_Defensive":     { effect:"xMult",            value:1.15, desc:"Suck them in, hold firm - x1.15" },
  "Possession_Transition":   { effect:"xMult",            value:1.2,  desc:"Unexpected speed shift - x1.2" },
  "Attacking_Attacking":     { effect:"xMult",            value:0.8,  desc:"Overcommitted! Too aggressive, exposed - x0.8" },
  "Transition_Defensive":    { effect:"xMult",            value:0.85, desc:"Panic clearance! Lost composure - x0.85" },
  "Defensive_Attacking":     { effect:"xMult",            value:0.9,  desc:"Disjointed! Route one failed - x0.9" },
  "Possession_Defensive":    { effect:"addChips",         value:-15,  desc:"Killed the tempo! Negative play - -15 chips" },
  "Transition_Possession":   { effect:"xMult",            value:0.85, desc:"Lost momentum! Hesitated on counter - x0.85" },
  "Attacking_Possession":    { effect:"xMult",            value:0.9,  desc:"Pulled back! Killed the attack - x0.9" },
  "Defensive_Possession":    { effect:"xMult",            value:0.9,  desc:"Too slow! Defence to possession transition - x0.9" },
};

export const COMBO_NO_MATCH_PENALTY = 0.95;

export const CAMPAIGN_MATCHES = [
  { name:"Group Stage",      opponent:"Wolves FC",                   targets:[2000,3500,5000],   tier:"Match 1/5", intro:"Relegation battlers. Sit deep - hard to break down.", tactics:["low_block"] },
  { name:"Round of 16",      opponent:"Inter Your-Nan",              targets:[3000,5000,7000],   tier:"Match 2/5", intro:"Mid-table side. Possession-heavy - counters are tough.", tactics:["possession_heavy"] },
  { name:"Quarter Final",    opponent:"Borussia Monchen-flapjack",   targets:[4000,6500,9000],   tier:"Match 3/5", intro:"Heavy metal football. Press relentlessly, hit on the break.", tactics:["high_press","counter_attack"] },
  { name:"Semi Final",       opponent:"Man City Oilers",             targets:[5000,8000,11500],  tier:"Match 4/5", intro:"Title favourites. Elite man-marking. Score early.", tactics:["man_mark","time_waste"] },
  { name:"THE FINAL",        opponent:"Galacticos FC",               targets:[6500,10000,14500], tier:"Match 5/5", intro:"The best in the world. Everything thrown at you.", tactics:["dirty_team","man_mark","high_press"] },
];

export const OPPONENT_TACTICS = {
  high_press:       { target:"phaseTag",   tags:["Possession","Defensive"], effect:"multiply", value:0.7,  desc:"High press disrupts build-up - Possession & Defensive phases x0.7" },
  low_block:        { target:"phaseTag",   tags:["Transition","Attacking"], effect:"multiply", value:0.75, desc:"Low block - Counter & Attacking phases x0.75" },
  man_mark:         { target:"bestPlayer",                                   effect:"multiply", value:0.6,  desc:"Your best player is man-marked - their contribution x0.6" },
  time_waste:       { target:"phaseIndex", indices:[2],                      effect:"multiply", value:0.5,  desc:"Time wasting - Phase 3 scores halved. Score early!" },
  dirty_team:       { target:"injury",                                       effect:"addRisk",  value:0.15, desc:"Dirty tackles - +15% injury risk on exhausted players" },
  possession_heavy: { target:"phaseTag",   tags:["Transition"],             effect:"multiply", value:0.7,  desc:"They keep the ball - Transition phases x0.7" },
  counter_attack:   { target:"phaseTag",   tags:["Attacking"],              effect:"multiply", value:0.7,  desc:"Sits deep and counters - Attacking phases x0.7" },
};

export const SHOP_ITEMS = {
  "energy_drink":     { name:"Energy Drink",             cost:2, effect:{type:"fullReset",       value:1},    desc:"Restore one players fatigue to 100%" },
  "tactical_upgrade": { name:"Tactical Upgrade",         cost:3, effect:{type:"coachingBuff",    value:25},   desc:"Next round: coaching detail adds +25 base chips" },
  "set_piece_drill":  { name:"Set Piece Drill",          cost:4, effect:{type:"chipsBuff",       value:40},   desc:"Next round: all phases get +40 chips" },
  "super_sub":        { name:"Super Sub",                cost:2, effect:{type:"superSub",        value:1.3},  desc:"Next round: fresh player gets x1.3" },
  "tactical_shift":   { name:"Tactical Shift",           cost:5, effect:{type:"addMultBuff",    value:5},    desc:"Next round: +5 add_mult on all phases" },
  "formation_tweak":  { name:"Formation Tweak",          cost:3, effect:{type:"formMult",        value:0.05}, desc:"+0.05 formation mult for next match" },
  "momentum_injector":{ name:"Momentum Injector",        cost:4, effect:{type:"momentumBoost",  value:1.5},  desc:"Next phase starts at x1.5 momentum" },
  "scout_report":     { name:"Scout Report",             cost:2, effect:{type:"scout",           value:1},    desc:"See all 8 phases this round" },
  "double_session":   { name:"Double Training Session",  cost:4, effect:{type:"fatiguePenalty",  value:1},    desc:"Next round: squad plays on fresh legs — no energy loss" },
  "morale_boost":     { name:"Morale Boost",             cost:1, effect:{type:"morale",          value:5},    desc:"+5 morale" },
};

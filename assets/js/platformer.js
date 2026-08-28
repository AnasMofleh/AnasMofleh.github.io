/* eslint-disable */
/**
 * Platformer home overlay — DOM-based retro platformer with a shared
 * room-state machine for both desktop player movement and mobile arrow
 * navigation. Consent-gated GA4 events are emitted via window.platformerTrack.
 */
(function () {
  "use strict";

  var d = document;
  var stage = d.querySelector("[data-platformer-stage]");
  if (!stage) return;

  var hero = d.getElementById("platformer-hero");
  var character = stage.querySelector("[data-character]");
  var roomLayer = d.querySelector("[data-room-layer]");
  var rooms = Array.prototype.slice.call(d.querySelectorAll(".platformer-room"));
  var helpRoot = stage.querySelector("[data-help]");
  var helpToggle = stage.querySelector("[data-help-toggle]");
  var helpPanel = stage.querySelector("[data-help-panel]");
  var consentBanner = d.querySelector("[data-consent-banner]");
  var consentAccept = d.querySelector("[data-consent-accept]");
  var consentDeny = d.querySelector("[data-consent-deny]");

  var track = function (name, params) {
    if (typeof window.platformerTrack === "function") {
      window.platformerTrack(name, params || {});
    }
  };

  /* -------- Consent banner -------- */
  (function consent() {
    if (!consentBanner) return;
    var stored = localStorage.getItem("platformer-consent");
    if (!stored) consentBanner.hidden = false;
    if (consentAccept) {
      consentAccept.addEventListener("click", function () {
        if (window.platformerSetConsent) window.platformerSetConsent(true);
        consentBanner.hidden = true;
        track("consent_granted");
      });
    }
    if (consentDeny) {
      consentDeny.addEventListener("click", function () {
        if (window.platformerSetConsent) window.platformerSetConsent(false);
        consentBanner.hidden = true;
      });
    }
  })();

  /* -------- Help toggle -------- */
  if (helpToggle && helpPanel) {
    helpToggle.addEventListener("click", function () {
      var open = helpRoot.classList.toggle("is-open");
      helpToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    // Auto-collapse after 4s the first time.
    setTimeout(function () {
      helpRoot.classList.remove("is-open");
      helpToggle.setAttribute("aria-expanded", "false");
    }, 4000);
    helpRoot.classList.add("is-open");
  }

  /* -------- Mobile detection -------- */
  function isTouchOrSmall() {
    return window.matchMedia("(hover: none), (max-width: 768px), (pointer: coarse)").matches;
  }

  /* -------- Room map -------- */
  // Each room is reachable from "home". Side/spawn determines transition direction.
  var ROOMS = {
    home:        { side: "center" },
    experiences: { side: "left",   from: "right",  back: "right"  }, // exit home top-left -> enter from right edge of room
    skills:      { side: "right",  from: "left",   back: "left"   },
    education:   { side: "left",   from: "right",  back: "right"  },
    projects:    { side: "right",  from: "left",   back: "left"   },
    intro:       { side: "bottom", from: "top",    back: "top"    }
  };

  /* -------- Populate room bodies from fallback sections -------- */
  rooms.forEach(function (room) {
    var sources = (room.getAttribute("data-room-source") || "").split(",");
    var body = room.querySelector("[data-room-body]");
    if (!body) return;
    sources.forEach(function (sel) {
      sel = sel.trim();
      if (!sel) return;
      var src = d.querySelector(sel);
      if (!src) return;
      var holder = src.closest(".section-holder") || src;
      var clone = holder.cloneNode(true);
      // De-duplicate IDs in the clone so the fallback owns the canonical anchors.
      Array.prototype.forEach.call(clone.querySelectorAll("[id]"), function (el) {
        el.removeAttribute("id");
      });
      clone.classList.add("platformer-room__cloned");
      body.appendChild(clone);
    });
  });

  /* -------- Active-room state machine -------- */
  var activeRoom = "home";
  var lastFocus = null;

  function setRoomVisible(name, dir) {
    rooms.forEach(function (r) {
      var on = r.getAttribute("data-room") === name;
      r.classList.toggle("is-active", on);
      r.classList.toggle("is-from-left",   on && dir === "left");
      r.classList.toggle("is-from-right",  on && dir === "right");
      r.classList.toggle("is-from-top",    on && dir === "top");
      r.classList.toggle("is-from-bottom", on && dir === "bottom");
      r.setAttribute("aria-hidden", on ? "false" : "true");
    });
    if (roomLayer) roomLayer.setAttribute("aria-hidden", name === "home" ? "true" : "false");
    stage.classList.toggle("is-blurred", name !== "home");
  }

  function enterRoom(name, opts) {
    if (!ROOMS[name] || name === "home" || activeRoom === name) return;
    var meta = ROOMS[name];
    lastFocus = d.activeElement;
    setRoomVisible(name, meta.from);
    activeRoom = name;
    var roomEl = d.querySelector('.platformer-room[data-room="' + name + '"]');
    if (roomEl) {
        var roomBody = roomEl.querySelector("[data-room-body]");
        if (roomBody) {
          roomBody.setAttribute("tabindex", "0");
          setTimeout(function () { roomBody.focus(); }, 250);
        }
    }
    track("room_entered", { room: name, method: (opts && opts.method) || "unknown" });
    // Pause game loop while a room is open.
    initRoomMiniGame(name);
    paused = true;
  }

  function exitRoom(method) {
    if (activeRoom === "home") return;
    var prev = activeRoom;
    setRoomVisible("home");
    activeRoom = "home";
    teardownRoomMiniGame();
    paused = false;
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
    track("room_exited", { room: prev, method: method || "unknown" });
    // Reposition character to the matching edge of home for a seamless feel.
    var meta = ROOMS[prev];
    if (character && meta) {
      if (meta.side === "left")   { player.x = 6; player.vx = 0.4; }
      else if (meta.side === "right") { player.x = stageRect().width - 6 - player.w; player.vx = -0.4; }
      else if (meta.side === "bottom") { player.x = stageRect().width / 2 - player.w / 2; player.y = 40; player.vy = 0; }
    }
  }

  // Wire up close buttons + destination buttons + pipe.
  d.querySelectorAll("[data-room-close]").forEach(function (b) {
    b.addEventListener("click", function () { exitRoom("button"); });
  });
  d.querySelectorAll("[data-room-link]").forEach(function (b) {
    b.addEventListener("click", function (ev) {
      ev.preventDefault();
      enterRoom(b.getAttribute("data-room-link"), { method: "arrow" });
    });
  });

  d.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && activeRoom !== "home") {
      ev.preventDefault();
      exitRoom("escape");
    }
  });

  /* -------- Game loop (desktop only) -------- */
  var paused = false;
  var charEnabled = !isTouchOrSmall();
  if (!charEnabled) {
    stage.classList.add("is-no-character");
    if (character) character.style.display = "none";
  }

  function stageRect() { return stage.getBoundingClientRect(); }

  // Player state — units in pixels relative to the stage.
  var player = {
    x: 40, y: 0, vx: 0, vy: 0, w: 64, h: 64,
    onGround: false, jumps: 0, facing: 1,
    anim: "idle", secondJumpAscent: false
  };

  // Physics tuning.
  var GRAVITY = 0.55;
  var MOVE = 0.55;
  var FRICTION = 0.82;
  var MAX_VX = 4.2;
  var JUMP_V = -12.5;

  var keys = { left: false, right: false, up: false, down: false };

  function setKey(k, v) { keys[k] = v; }

  d.addEventListener("keydown", function (ev) {
    if (!charEnabled) return;
    // In a room: only capture left/right for the mini-game; let everything
    // else pass through so the room body can still be scrolled with arrow keys.
    if (activeRoom !== "home") {
      switch (ev.key) {
        case "ArrowLeft":  case "a": case "A": setKey("left",  true); ev.preventDefault(); break;
        case "ArrowRight": case "d": case "D": setKey("right", true); ev.preventDefault(); break;
      }
      return;
    }
    switch (ev.key) {
      case "ArrowLeft":  case "a": case "A": setKey("left",  true);  ev.preventDefault(); break;
      case "ArrowRight": case "d": case "D": setKey("right", true);  ev.preventDefault(); break;
      case "ArrowUp":    case "w": case "W": case " ": case "Spacebar":
        if (!keys.up) tryJump();
        setKey("up", true);
        ev.preventDefault();
        break;
      case "ArrowDown":  case "s": case "S":
        setKey("down", true);
        // Pipe entry if on top of pipe.
        if (onPipe()) { enterRoom("intro", { method: "pipe" }); }
        ev.preventDefault();
        break;
    }
  });
  d.addEventListener("keyup", function (ev) {
    switch (ev.key) {
      case "ArrowLeft":  case "a": case "A": setKey("left",  false); break;
      case "ArrowRight": case "d": case "D": setKey("right", false); break;
      case "ArrowUp":    case "w": case "W": case " ": case "Spacebar": setKey("up", false); break;
      case "ArrowDown":  case "s": case "S": setKey("down", false); break;
    }
  });

  function tryJump() {
    // Jumping while resting in a pipe mouth enters the pipe.
    if (ledgePipe && player.onGround) {
      startPipeEntry(ledgePipe);
      track("player_entered_pipe", { room: ledgePipe.room });
      return;
    }
    if (player.jumps < 2) {
      player.vy = JUMP_V * (player.jumps === 0 ? 1 : 0.85);
      player.jumps += 1;
      player.onGround = false;
      player.secondJumpAscent = player.jumps === 2;
      track("player_jump", { double: player.jumps === 2 ? 1 : 0 });
    }
  }

  // Resolve platforms from DOM at runtime so CSS controls geometry.
  function getPlatforms() {
    var srect = stageRect();
    var nodes = stage.querySelectorAll("[data-platform]");
    var list = [];
    Array.prototype.forEach.call(nodes, function (n) {
      var r = n.getBoundingClientRect();
      list.push({
        id: n.getAttribute("data-platform-id"),
        x: r.left - srect.left,
        y: r.top - srect.top,
        w: r.width,
        h: r.height,
        node: n
      });
    });
    return list;
  }

  // The author photo circle in the home hero is a fully solid circular
  // obstacle: the player can stand on it, hit the bottom, and bounce off the
  // sides. Resolved as a circle with center + radius in stage coordinates.
  function getPhotoCircle() {
    var photo = d.querySelector(".platformer-shell .container.content img.rounded-circle, .platformer-shell #home img.rounded-circle");
    if (!photo) return null;
    var srect = stageRect();
    var pr = photo.getBoundingClientRect();
    return {
      cx: pr.left - srect.left + pr.width / 2,
      cy: pr.top  - srect.top  + pr.height / 2,
      r:  Math.min(pr.width, pr.height) / 2
    };
  }

  function pipeRect() {
    var p = getPlatforms();
    for (var i = 0; i < p.length; i++) if (p[i].id === "pipe") return p[i];
    return null;
  }

  // The four edge warp pipes as solid bodies (stage coordinates).
  // Each pipe has a mouth window of PIPE_MOUTH px below its top; under the
  // window the pipe is solid. Mario rests half-in/half-out on the mouth's
  // inner ledge and enters the room by jumping while resting.
  function getEdgePipes() {
    var srect = stageRect();
    var nodes = stage.querySelectorAll(".platformer-pipe--edge");
    var list = [];
    Array.prototype.forEach.call(nodes, function (n) {
      var r = n.getBoundingClientRect();
      list.push({
        x: r.left - srect.left,
        y: r.top - srect.top,
        w: r.width,
        h: r.height,
        room: n.getAttribute("data-room-link"),
        side: n.className.indexOf("--edge-left") >= 0 ? "left" : "right"
      });
    });
    return list;
  }

  var PIPE_MOUTH = 58;          // mouth window depth from the pipe top
  var PIPE_ENTRY_FRAMES = 12;   // sink-in animation length
  var ledgePipe = null;         // pipe whose mouth Mario is resting in
  var pipeEntry = null;         // { room, side, from, to, t } sink animation

  function startPipeEntry(pipe) {
    var srect = stageRect();
    var from = pipe.side === "left"
      ? pipe.x + pipe.w - player.w / 2
      : pipe.x - player.w / 2;
    var to = pipe.side === "left" ? -16 : srect.width - 16;
    pipeEntry = { room: pipe.room, side: pipe.side, from: from, to: to, t: 0 };
    player.jumps = 0;
    player.vx = 0;
    player.vy = 0;
  }

  function onPipe() {
    var pr = pipeRect();
    if (!pr) return false;
    return player.onGround &&
      player.x + player.w > pr.x + 4 &&
      player.x < pr.x + pr.w - 4 &&
      Math.abs((player.y + player.h) - pr.y) < 4;
  }

  function updateCharacterState() {
    if (player.onGround) {
      player.anim = Math.abs(player.vx) > 0.45 ? "run" : "idle";
      player.secondJumpAscent = false;
      return;
    }
    if (player.secondJumpAscent) {
      player.anim = "tailspin";
      return;
    }
    if (player.vy < 0) {
      player.anim = "jump";
      return;
    }
    player.anim = "fall";
  }

  // Frame data — Mario sprite strips (SMB1 small Mario, 16×16 cells).
  // Working at native pixel coordinates (no scale multiplier).
  // Each image config: { url, w (sheet width), h (sheet height), fw (frame width), fh (frame height) }

  // Standing — single frame, 17×16
  var STAND_IMG = { url: '/images/game/standing.png', w: 17, h: 16, fw: 17, fh: 16 };
  var STAND_FRAMES = [{ x: 0 }];

  // Running — 3 frames of 16×16
  var RUN_IMG = { url: '/images/game/running.png', w: 48, h: 16, fw: 16, fh: 16 };
  var RUN_FRAMES = [
    { x: 0  },
    { x: 16 },
    { x: 32 },
  ];

  // Jumping — 3 frames of 16×16 (last frame reserved for fall)
  var JUMP_IMG = { url: '/images/game/jumping.png', w: 48, h: 16, fw: 16, fh: 16 };
  var JUMP_FRAMES = [
    { x: 0  },
    { x: 16 },
    { x: 32 },
  ];

  var walkFrameIdx  = 0;
  var walkLastMs    = 0;
  var WALK_FRAME_MS = 100;  // 400ms / 4 frames

  var jumpFrameIdx  = 0;
  var jumpLastMs    = 0;
  var JUMP_FRAME_MS = 840;  // 840ms / 7 frames — slower, feels more weighty

  var CHAR_SCALE = 4;  // 16px cells → 64px display size

  // Room mini-game
  var ROOM_INTRO_SPEED = 3;    // px per frame for the walk-in animation
  var roomPlayer = { x: 0, vx: 0, facing: 1, anim: "idle" };
  var roomChar      = null;
  var roomMiniStage = null;
  var roomMeta      = null;   // set in initRoomMiniGame
  var roomPhase     = "off"; // "off" | "intro" | "play"
  var roomWalkFrameIdx = 0;
  var roomWalkLastMs   = 0;

  function setFrame(img, frame) {
    character.style.backgroundImage = "url('" + img.url + "')";
    character.style.backgroundSize = (img.w * CHAR_SCALE) + "px " + (img.h * CHAR_SCALE) + "px";
    character.style.backgroundPositionX = -(frame.x * CHAR_SCALE) + "px";
    character.style.backgroundPositionY = -((frame.y || 0) * CHAR_SCALE) + "px";
    character.style.backgroundRepeat = "no-repeat";
    character.style.width = (img.fw * CHAR_SCALE) + "px";
    character.style.height = (img.fh * CHAR_SCALE) + "px";
  }

  function applyCharacterClasses() {
    if (!character) return;
    var anim = player.anim;
    character.classList.toggle("is-idle",     anim === "idle");
    character.classList.toggle("is-run",      anim === "run");
    character.classList.toggle("is-jump",     anim === "jump");
    character.classList.toggle("is-fall",     anim === "fall");
    character.classList.toggle("is-tailspin", anim === "tailspin");

    if (anim === "run") {
      var now = performance.now();
      if (now - walkLastMs >= WALK_FRAME_MS) {
        // Loop all 4 frames
        walkFrameIdx = (walkFrameIdx + 1) % RUN_FRAMES.length;
        walkLastMs   = now;
      }
      setFrame(RUN_IMG, RUN_FRAMES[walkFrameIdx]);
      jumpFrameIdx = 0;
      jumpLastMs   = 0;
    } else if (anim === "jump" || anim === "tailspin") {
      // Both jump and double-jump share the jumping animation
      var now = performance.now();
      if (now - jumpLastMs >= JUMP_FRAME_MS) {
        // Play frames sequentially, stop at last
        jumpFrameIdx = Math.min(jumpFrameIdx + 1, JUMP_FRAMES.length - 1);
        jumpLastMs   = now;
      }
      setFrame(JUMP_IMG, JUMP_FRAMES[jumpFrameIdx]);
      walkFrameIdx = 0;
      walkLastMs   = 0;
    } else if (anim === "idle") {
      setFrame(STAND_IMG, STAND_FRAMES[0]);
      walkFrameIdx = 0;
      walkLastMs   = 0;
      jumpFrameIdx = 0;
      jumpLastMs   = 0;
    } else {
      // fall — last frame of jumping
      setFrame(JUMP_IMG, JUMP_FRAMES[JUMP_FRAMES.length - 1]);
      walkFrameIdx = 0;
      walkLastMs   = 0;
      jumpFrameIdx = JUMP_FRAMES.length - 1;
      jumpLastMs   = 0;
    }
  }

  function applyTransform() {
    if (!character) return;
    updateCharacterState();
    applyCharacterClasses();
    character.style.transform =
      "translate3d(" + player.x + "px," + player.y + "px,0) scaleX(" + player.facing + ")";
  }

  /* -------- Room mini-game -------- */
  function setRoomFrame(img, frame) {
    if (!roomChar) return;
    roomChar.style.backgroundImage     = "url('" + img.url + "')";
    roomChar.style.backgroundSize      = (img.w * CHAR_SCALE) + "px " + (img.h * CHAR_SCALE) + "px";
    roomChar.style.backgroundPositionX = -(frame.x * CHAR_SCALE) + "px";
    roomChar.style.backgroundPositionY = -((frame.y || 0) * CHAR_SCALE) + "px";
    roomChar.style.backgroundRepeat    = "no-repeat";
    roomChar.style.width               = (img.fw * CHAR_SCALE) + "px";
    roomChar.style.height              = (img.fh * CHAR_SCALE) + "px";
  }

  function applyRoomCharTransform() {
    if (!roomChar) return;
    if (roomPlayer.anim === "run") {
      var now = performance.now();
      if (now - roomWalkLastMs >= WALK_FRAME_MS) {
        roomWalkFrameIdx = (roomWalkFrameIdx + 1) % RUN_FRAMES.length;
        roomWalkLastMs   = now;
      }
      setRoomFrame(RUN_IMG, RUN_FRAMES[roomWalkFrameIdx]);
    } else {
      roomWalkFrameIdx = 0;
      roomWalkLastMs   = 0;
      setRoomFrame(STAND_IMG, STAND_FRAMES[0]);
    }
    roomChar.style.transform = "translate3d(" + roomPlayer.x + "px,0,0) scaleX(" + roomPlayer.facing + ")";
  }

  function initRoomMiniGame(roomName) {
    var meta = ROOMS[roomName];
    if (!meta || meta.side === "bottom") return; // skip intro/socials room
    var roomEl = d.querySelector('.platformer-room[data-room="' + roomName + '"]');
    if (!roomEl) return;
    var frame = roomEl.querySelector('.platformer-room__frame');
    if (!frame) return;

    // Remove any stale mini-stage
    var prev = frame.querySelector('.room-mini-stage');
    if (prev) prev.remove();

    var miniStage = d.createElement('div');
    miniStage.className = 'room-mini-stage';
    miniStage.setAttribute('aria-hidden', 'true');

    var ground = d.createElement('div');
    ground.className = 'room-mini-ground';
    miniStage.appendChild(ground);

    var char = d.createElement('div');
    char.className = 'platformer-character room-mini-character';
    char.setAttribute('aria-hidden', 'true');
    miniStage.appendChild(char);

    frame.appendChild(miniStage);
    roomMiniStage = miniStage;
    roomChar      = char;

    var stageW    = frame.getBoundingClientRect().width;
    var charW     = player.w;
    var fromSide  = meta.from; // "left" or "right"

    roomMeta = { from: fromSide, stageW: stageW, charW: charW };

    if (fromSide === "right") {
      // Player walked off right of home → character enters room from the right
      roomPlayer.x      = stageW;
      roomPlayer.facing = -1;
      roomMeta.restX    = stageW - charW;  // right edge of popup
      roomMeta.deepX    = 0;               // dead end: left edge of popup
      roomMeta.exitX    = stageW;          // walk fully off right edge → exit
    } else {
      // Player walked off left of home → character enters room from the left
      roomPlayer.x      = -charW;
      roomPlayer.facing = 1;
      roomMeta.restX    = 0;               // left edge of popup
      roomMeta.deepX    = stageW - charW;  // dead end: right edge of popup
      roomMeta.exitX    = -charW;          // walk fully off left edge → exit
    }

    roomPlayer.vx   = 0;
    roomPlayer.anim = "run";
    roomPhase       = "intro";
    roomChar.style.visibility = "visible";
    applyRoomCharTransform();
  }

  function teardownRoomMiniGame() {
    roomPhase = "off";
    if (roomMiniStage) { roomMiniStage.remove(); roomMiniStage = null; }
    roomChar = null;
    roomMeta = null;
  }

  function stepRoomMiniGame() {
    if (roomPhase === "off" || !roomChar || !roomMeta) return;
    var fromRight = roomMeta.from === "right";

    if (roomPhase === "intro") {
      // Auto-walk character to rest position
      if (fromRight) {
        roomPlayer.x -= ROOM_INTRO_SPEED;
        if (roomPlayer.x <= roomMeta.restX) { roomPlayer.x = roomMeta.restX; roomPlayer.anim = "idle"; roomPhase = "play"; }
      } else {
        roomPlayer.x += ROOM_INTRO_SPEED;
        if (roomPlayer.x >= roomMeta.restX) { roomPlayer.x = roomMeta.restX; roomPlayer.anim = "idle"; roomPhase = "play"; }
      }

    } else if (roomPhase === "play") {
      if (keys.left)  { roomPlayer.vx -= MOVE; roomPlayer.facing = -1; }
      if (keys.right) { roomPlayer.vx += MOVE; roomPlayer.facing =  1; }
      if (!keys.left && !keys.right) roomPlayer.vx *= FRICTION;
      if (roomPlayer.vx >  MAX_VX) roomPlayer.vx =  MAX_VX;
      if (roomPlayer.vx < -MAX_VX) roomPlayer.vx = -MAX_VX;

      roomPlayer.anim = Math.abs(roomPlayer.vx) > 0.45 ? "run" : "idle";
      var nx = roomPlayer.x + roomPlayer.vx;

      // Walking back off the entry edge → return to home
      if (fromRight && nx >= roomMeta.exitX) { teardownRoomMiniGame(); exitRoom("player"); return; }
      if (!fromRight && nx <= roomMeta.exitX) { teardownRoomMiniGame(); exitRoom("player"); return; }

      // Dead-end wall — block going deeper into the room
      if (fromRight  && nx < roomMeta.deepX) { nx = roomMeta.deepX; roomPlayer.vx = 0; }
      if (!fromRight && nx > roomMeta.deepX) { nx = roomMeta.deepX; roomPlayer.vx = 0; }

      roomPlayer.x = nx;
    }

    applyRoomCharTransform();
  }

  function step() {
    if (charEnabled && !paused && activeRoom === "home") {
      var srect = stageRect();

      // Pipe entry animation — sinking into the pipe after jumping in.
      if (pipeEntry) {
        pipeEntry.t += 1;
        var pe = pipeEntry;
        var pct = Math.min(pe.t / PIPE_ENTRY_FRAMES, 1);
        player.x = pe.from + (pe.to - pe.from) * pct;
        player.vx = 0;
        player.vy = 0;
        player.anim = "idle";
        stage.classList.add("is-pipe-cover");
        applyTransform();
        if (pct >= 1) {
          pipeEntry = null;
          ledgePipe = null;
          stage.classList.remove("is-pipe-cover");
          enterRoom(pe.room, { method: "player" });
        }
        return scheduleNext();
      }

      // Horizontal input.
      if (keys.left)  { player.vx -= MOVE; player.facing = -1; }
      if (keys.right) { player.vx += MOVE; player.facing =  1; }
      if (!keys.left && !keys.right) player.vx *= FRICTION;
      if (player.vx >  MAX_VX) player.vx =  MAX_VX;
      if (player.vx < -MAX_VX) player.vx = -MAX_VX;

      // Gravity.
      player.vy += GRAVITY;
      if (player.vy > 14) player.vy = 14;

      var nx = player.x + player.vx;
      var ny = player.y + player.vy;

      // Collide platforms (top-only landing).
      var plats = getPlatforms();
      var prevBottom = player.y + player.h;
      var nextBottom = ny + player.h;
      player.onGround = false;
      for (var i = 0; i < plats.length; i++) {
        var p = plats[i];
        var overlapsX = nx + player.w > p.x + 2 && nx < p.x + p.w - 2;
        if (overlapsX && player.vy >= 0 && prevBottom <= p.y + 2 && nextBottom >= p.y) {
          ny = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
          player.jumps = 0;
          player.secondJumpAscent = false;
          break;
        }
      }

      // Pipe side/bottom collision — the pipe is a solid wall, not just a ledge.
      for (var pi = 0; pi < plats.length; pi++) {
        if (plats[pi].id !== "pipe") continue;
        var pp = plats[pi];
        var overlapsY = ny + player.h > pp.y + 2 && ny < pp.y + pp.h;
        var overlapsXp = nx + player.w > pp.x && nx < pp.x + pp.w;
        if (overlapsXp && overlapsY) {
          // Resolve horizontally based on previous position.
          if (player.x + player.w <= pp.x + 1) {
            nx = pp.x - player.w;
            if (player.vx > 0) player.vx = 0;
          } else if (player.x >= pp.x + pp.w - 1) {
            nx = pp.x + pp.w;
            if (player.vx < 0) player.vx = 0;
          }
        }
      }

      // Solid edge warp pipes — Mario-style: stand on top, bump the bottom,
      // rest half-in/half-out on the mouth's inner ledge, and enter by
      // jumping while resting. The solid lower part keeps him in front of
      // the pipe at ground level.
      var edgePipes = getEdgePipes();
      var edgePrevBottom = player.y + player.h;
      var edgePrevTop = player.y;
      ledgePipe = null;
      for (var ei = 0; ei < edgePipes.length; ei++) {
        var ep = edgePipes[ei];
        var innerFace = ep.side === "left" ? ep.x + ep.w : ep.x;
        var ledgeY = ep.y + PIPE_MOUTH;
        var overlapsXe = nx + player.w > ep.x && nx < ep.x + ep.w;
        var edgeNextBottom = ny + player.h;
        var edgeNextTop = ny;

        // Top landing — stand on the pipe like on a platform.
        if (player.vy >= 0 && edgePrevBottom <= ep.y + 2 && edgeNextBottom >= ep.y && overlapsXe) {
          ny = ep.y - player.h;
          player.vy = 0;
          player.onGround = true;
          player.jumps = 0;
          player.secondJumpAscent = false;
          break;
        }

        // Bottom bump — cannot jump through the pipe from below.
        if (player.vy < 0 && edgePrevTop >= ep.y + ep.h - 2 && edgeNextTop <= ep.y + ep.h && overlapsXe) {
          ny = ep.y + ep.h;
          player.vy = 0;
          continue;
        }

        // Solid lower part — blocks entry below the mouth window.
        var inSolidPart = ny + player.h > ledgeY + 2 && ny < ep.y + ep.h;
        var crossingInner = ep.side === "left" ? nx < innerFace : nx + player.w > innerFace;
        if (inSolidPart && crossingInner) {
          if (ep.side === "left") {
            nx = innerFace - 2;   // flush against the pipe face, in front
            if (player.vx < 0) player.vx = 0;
          } else {
            nx = innerFace - player.w + 2;
            if (player.vx > 0) player.vx = 0;
          }
          continue;
        }

        // Mouth window catches — rising or falling into the mouth rests
        // Mario on the inner ledge, snapped to the half-in/half-out spot.
        var restXep = ep.side === "left"
          ? ep.x + ep.w - player.w / 2
          : ep.x - player.w / 2;
        var nearMouth = ep.side === "left"
          ? nx + player.w > innerFace - 4 && nx < innerFace + 40
          : nx + player.w > innerFace - 40 && nx < innerFace + 4;
        var inWindow = ny + player.h > ep.y + 2 && ny < ledgeY + 2;
        if (inWindow && nearMouth) {
          if (player.vy < 0 && edgePrevBottom >= ledgeY && edgeNextBottom <= ledgeY) {
            // Rising into the mouth — caught on the ledge.
            ny = ledgeY - player.h;
            nx = restXep;
            player.vy = 0;
            player.vx = 0;
            player.onGround = true;
            player.jumps = 0;
            player.secondJumpAscent = false;
            ledgePipe = ep;
            break;
          }
          if (player.vy >= 0 && edgePrevBottom <= ledgeY + 2 && edgeNextBottom >= ledgeY) {
            // Falling into the mouth — rest on the ledge.
            ny = ledgeY - player.h;
            nx = restXep;
            player.vy = 0;
            player.vx = 0;
            player.onGround = true;
            player.jumps = 0;
            player.secondJumpAscent = false;
            ledgePipe = ep;
            break;
          }
        }
      }

      // Resting in a mouth: support detection for players standing on a
      // surface inside the window band (e.g. the edge platforms), and the
      // half-in/half-out rest clamp.
      if (!ledgePipe && player.onGround) {
        for (var li = 0; li < edgePipes.length; li++) {
          var lp = edgePipes[li];
          var lpLedge = lp.y + PIPE_MOUTH;
          var inX = player.x + player.w > lp.x + 4 && player.x < lp.x + lp.w - 4;
          var feet = ny + player.h;
          if (inX && feet > lp.y + 2 && feet <= lpLedge + 2) {
            ledgePipe = lp;
            break;
          }
        }
      }
      if (ledgePipe) {
        var restX = ledgePipe.side === "left"
          ? ledgePipe.x + ledgePipe.w - player.w / 2
          : ledgePipe.x - player.w / 2;
        if (ledgePipe.side === "left") {
          nx = Math.max(nx, restX);   // can't walk deeper into the tube
        } else {
          nx = Math.min(nx, restX);
        }
      }

      // Ground collision (stage floor).
      var floorY = srect.height - 18 - player.h;
      if (ny >= floorY) {
        ny = floorY;
        player.vy = 0;
        player.onGround = true;
        player.jumps = 0;
        player.secondJumpAscent = false;
      }

      // Author photo circle — land on top only, like a platform.
      // Player can walk through from the sides and under freely.
      var circle = getPhotoCircle();
      if (circle) {
        var circleTop = circle.cy - circle.r;
        var prevBottom = player.y + player.h;
        var nextBottom = ny + player.h;
        var overlapsCX = nx + player.w > circle.cx - circle.r && nx < circle.cx + circle.r;
        if (overlapsCX && player.vy >= 0 && prevBottom <= circleTop + 2 && nextBottom >= circleTop) {
          ny = circleTop - player.h;
          player.vy = 0;
          player.onGround = true;
          player.jumps = 0;
          player.secondJumpAscent = false;
        }
      }

      // Respawn collected coins after a minute so readers can see what
      // they missed — the coin quietly returns to its spot.
      var nowMs = performance.now();
      for (var ri = 0; ri < coins.length; ri++) {
        var rc = coins[ri];
        if (rc.collected && rc.respawnAt && nowMs >= rc.respawnAt) {
          rc.collected = false;
          rc.respawnAt = null;
          rc.node = makeCoinNode(rc);
          stage.appendChild(rc.node);
        }
      }
      if (coinCountEl) coinCountEl.textContent = String(coins.filter(function (c) { return c.collected; }).length);

      // Coin pickups — forgiving AABB (player box shrunk 8px per side).
      for (var ci = 0; ci < coins.length; ci++) {
        var coin = coins[ci];
        if (coin.collected) continue;
        var pL = nx + 8, pR = nx + player.w - 8, pT = ny + 8, pB = ny + player.h - 8;
        if (pR > coin.x && pL < coin.x + 24 && pB > coin.y && pT < coin.y + 32) {
          collectCoin(coin);
        }
      }

      // Screen edges are hard walls — rooms are entered only through pipes.
      if (nx < -player.w * 0.6) nx = -player.w * 0.6;
      if (nx > srect.width - player.w * 0.4) nx = srect.width - player.w * 0.4;

      player.x = nx;
      player.y = ny;
      applyTransform();
    }
    if (charEnabled && activeRoom !== "home" && activeRoom !== "intro") {
      stepRoomMiniGame();
    }
    scheduleNext();
  }

  function scheduleNext() { requestAnimationFrame(step); }

  // Spawn character above the stage so it drops down into view.
  function initPlayer() {
    var srect = stageRect();
    player.x = Math.min(srect.width * 0.78, srect.width - 60);
    player.y = -player.h;   // start above the stage
    player.vx = 0;
    player.vy = 3;          // give it a push downward
    player.anim = "fall";
    player.secondJumpAscent = false;
    if (character) character.style.visibility = "visible";
    applyTransform();
  }
  // Wait for layout, then spawn with a short delay so rAF runs smoothly.
  window.addEventListener("load", function () {
    setTimeout(function () {
      initPlayer();
      spawnCoins();
      scheduleNext();
    }, 250);
  });
  window.addEventListener("resize", function () {
    var wasMobile = !charEnabled;
    charEnabled = !isTouchOrSmall();
    stage.classList.toggle("is-no-character", !charEnabled);
    if (character) character.style.display = charEnabled ? "" : "none";
    if (!charEnabled) teardownRoomMiniGame();
    if (charEnabled && wasMobile) initPlayer();
    if (charEnabled) spawnCoins();
  });

  /* -------- Skill coins --------
     One coin per certification (from the skills data JSON). Coins rest on
     the platforms; collecting one pops a fading skill-name label and bumps
     the HUD counter. Collected state lasts for the session. */
  var coins = [];        // { name, x, y, node, collected }
  var coinsHudEl = stage.querySelector("[data-coins-hud]");
  var coinCountEl = stage.querySelector("[data-coins-count]");

  function coinNames() {
    var el = d.getElementById("platformer-skills-data");
    if (!el) return [];
    try {
      return (JSON.parse(el.textContent) || []).map(function (s) { return s.name; }).filter(Boolean);
    } catch (e) { return []; }
  }

  function makeCoinNode(c) {
    var node = d.createElement("div");
    node.className = "platformer-coin";
    node.setAttribute("data-skill", c.name);
    node.style.left = c.x + "px";
    node.style.top  = c.y + "px";
    return node;
  }

  function spawnCoins() {
    if (isTouchOrSmall()) return;
    var plats = getPlatforms().filter(function (p) { return p.id !== "pipe" && p.w >= 60; });
    if (!plats.length) return;

    // First run: build one coin per certification.
    if (!coins.length) {
      coins = coinNames().map(function (name) {
        return { name: name, x: 0, y: 0, node: null, collected: false };
      });
    }
    if (!coins.length) return;

    // (Re-)pin every uncollected coin above a platform.
    var placed = 0;
    coins.forEach(function (c) {
      if (c.collected) return;
      var plat = plats[placed % plats.length];
      var idx  = Math.floor(placed / plats.length);
      var frac = 0.2 + 0.3 * Math.min(idx, 2);   // up to 3 coins per platform
      c.x = plat.x + plat.w * frac - 12;
      c.y = plat.y - 38;
      if (c.node && c.node.parentNode) c.node.parentNode.removeChild(c.node);
      c.node = makeCoinNode(c);
      stage.appendChild(c.node);
      placed++;
    });
    if (coinCountEl) coinCountEl.textContent = String(coins.filter(function (c) { return c.collected; }).length);
  }

  function showCoinPopup(coin) {
    var pop = d.createElement("div");
    pop.className = "platformer-coin-popup";
    pop.textContent = coin.name;
    pop.style.left = (coin.x + 12) + "px";
    pop.style.top  = (coin.y - 10) + "px";
    stage.appendChild(pop);
    pop.addEventListener("animationend", function () {
      if (pop.parentNode) pop.parentNode.removeChild(pop);
    });
  }

  function collectCoin(coin) {
    coin.collected = true;
    coin.respawnAt = performance.now() + 60000;  // reappears after a minute
    if (coin.node && coin.node.parentNode) coin.node.parentNode.removeChild(coin.node);
    coin.node = null;
    var collected = coins.filter(function (c) { return c.collected; }).length;
    if (coinCountEl) coinCountEl.textContent = String(collected);
    showCoinPopup(coin);
    track("coin_collected", { skill: coin.name });
    if (collected === coins.length && coinsHudEl) {
      coinsHudEl.classList.add("is-flash");
      track("all_coins_collected");
    }
  }

})();

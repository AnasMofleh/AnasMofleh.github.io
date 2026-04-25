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
      var closeBtn = roomEl.querySelector("[data-room-close]");
      if (closeBtn) setTimeout(function () { closeBtn.focus(); }, 250);
    }
    track("room_entered", { room: name, method: (opts && opts.method) || "unknown" });
    // Pause game loop while a room is open.
    paused = true;
  }

  function exitRoom(method) {
    if (activeRoom === "home") return;
    var prev = activeRoom;
    setRoomVisible("home");
    activeRoom = "home";
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
  var player = { x: 40, y: 0, vx: 0, vy: 0, w: 28, h: 36, onGround: false, jumps: 0, facing: 1 };

  // Physics tuning.
  var GRAVITY = 0.55;
  var MOVE = 0.55;
  var FRICTION = 0.82;
  var MAX_VX = 4.2;
  var JUMP_V = -10.5;

  var keys = { left: false, right: false, up: false, down: false };

  function setKey(k, v) { keys[k] = v; }

  d.addEventListener("keydown", function (ev) {
    if (!charEnabled || activeRoom !== "home") return;
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
    if (player.jumps < 2) {
      player.vy = JUMP_V * (player.jumps === 0 ? 1 : 0.85);
      player.jumps += 1;
      player.onGround = false;
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

  function onPipe() {
    var pr = pipeRect();
    if (!pr) return false;
    return player.onGround &&
      player.x + player.w > pr.x + 4 &&
      player.x < pr.x + pr.w - 4 &&
      Math.abs((player.y + player.h) - pr.y) < 4;
  }

  function applyTransform() {
    if (!character) return;
    character.style.transform =
      "translate3d(" + player.x + "px," + player.y + "px,0) scaleX(" + player.facing + ")";
  }

  function step() {
    if (charEnabled && !paused && activeRoom === "home") {
      var srect = stageRect();

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
        break;
      }

      // Ground collision (stage floor).
      var floorY = srect.height - 18 - player.h;
      if (ny >= floorY) {
        ny = floorY;
        player.vy = 0;
        player.onGround = true;
        player.jumps = 0;
      }

      // Author photo circle — fully solid obstacle. Resolve by pushing the
      // player AABB out of the circle along the smallest axis.
      var circle = getPhotoCircle();
      if (circle) {
        for (var iter = 0; iter < 2; iter++) {
          var bx = nx + player.w / 2;
          var by = ny + player.h / 2;
          // Closest point on AABB to circle center.
          var clampedX = Math.max(nx, Math.min(circle.cx, nx + player.w));
          var clampedY = Math.max(ny, Math.min(circle.cy, ny + player.h));
          var dx = clampedX - circle.cx;
          var dy = clampedY - circle.cy;
          var dist2 = dx * dx + dy * dy;
          if (dist2 >= circle.r * circle.r) break;
          var dist = Math.sqrt(dist2) || 0.0001;
          var overlap = circle.r - dist;
          // Direction from circle center to player center for separation.
          var pdx = bx - circle.cx;
          var pdy = by - circle.cy;
          var pdLen = Math.sqrt(pdx * pdx + pdy * pdy) || 0.0001;
          var nxn = pdx / pdLen;
          var nyn = pdy / pdLen;
          nx += nxn * overlap;
          ny += nyn * overlap;
          // Kill velocity into the surface.
          if (nyn < -0.5 && player.vy > 0) {
            player.vy = 0;
            player.onGround = true;
            player.jumps = 0;
          } else if (nyn > 0.5 && player.vy < 0) {
            player.vy = 0;
          }
          if (nxn < -0.5 && player.vx > 0) player.vx = 0;
          if (nxn >  0.5 && player.vx < 0) player.vx = 0;
        }
      }

      // Edge transitions — direction maps to room.
      if (nx < -player.w * 0.6) {
        // Left edge: top half -> experiences, bottom half -> education.
        var room = (player.y + player.h / 2) < srect.height / 2 ? "experiences" : "education";
        player.x = -player.w * 0.6; player.y = ny; applyTransform();
        enterRoom(room, { method: "player" });
        return scheduleNext();
      }
      if (nx > srect.width - player.w * 0.4) {
        var room2 = (player.y + player.h / 2) < srect.height / 2 ? "skills" : "projects";
        player.x = srect.width - player.w * 0.4; player.y = ny; applyTransform();
        enterRoom(room2, { method: "player" });
        return scheduleNext();
      }

      player.x = nx;
      player.y = ny;
      applyTransform();
    }
    scheduleNext();
  }

  function scheduleNext() { requestAnimationFrame(step); }

  // Initial position + start. Spawn well to the right of the pipe so the
  // player isn't trapped under any platform on first frame.
  function initPlayer() {
    var srect = stageRect();
    player.x = Math.min(srect.width * 0.78, srect.width - 60);
    player.y = srect.height - 18 - player.h;
    player.vx = 0;
    player.vy = 0;
    applyTransform();
  }
  // Wait for layout.
  window.addEventListener("load", function () {
    initPlayer();
    scheduleNext();
  });
  window.addEventListener("resize", function () {
    var wasMobile = !charEnabled;
    charEnabled = !isTouchOrSmall();
    stage.classList.toggle("is-no-character", !charEnabled);
    if (character) character.style.display = charEnabled ? "" : "none";
    if (charEnabled && wasMobile) initPlayer();
  });

  /* -------- Click-to-enter on pipe also for desktop -------- */
  var pipeBtn = stage.querySelector(".platformer-pipe");
  if (pipeBtn) {
    pipeBtn.addEventListener("click", function (ev) {
      ev.preventDefault();
      enterRoom("intro", { method: "pipe-click" });
    });
  }

  /* -------- Neon color picker -------- */
  (function colorPicker() {
    var picker = d.querySelector("[data-color-picker]");
    if (!picker) return;
    var input = picker.querySelector("[data-color-input]");
    var reset = picker.querySelector("[data-color-reset]");
    var KEY = "platformer-neon-color";
    var DEFAULT = "#00f0ff";

    function hexToRgb(h) {
      var s = h.replace("#", "");
      if (s.length === 3) s = s.split("").map(function (c) { return c + c; }).join("");
      var n = parseInt(s, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    function rgbToHex(r, g, b) {
      return "#" + [r, g, b].map(function (v) {
        var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
        return s.length === 1 ? "0" + s : s;
      }).join("");
    }
    function darken(hex, amt) {
      var c = hexToRgb(hex);
      return rgbToHex(c.r * (1 - amt), c.g * (1 - amt), c.b * (1 - amt));
    }

    function apply(hex) {
      var root = d.documentElement.style;
      root.setProperty("--pf-neon", hex);
      root.setProperty("--pf-neon-deep", darken(hex, 0.45));
      var rgb = hexToRgb(hex);
      root.setProperty("--pf-neon-soft", "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.85)");
      if (input) input.value = hex;
    }

    var saved = localStorage.getItem(KEY);
    if (saved) apply(saved);

    if (input) {
      input.addEventListener("input", function () {
        apply(input.value);
        localStorage.setItem(KEY, input.value);
      });
    }
    if (reset) {
      reset.addEventListener("click", function () {
        apply(DEFAULT);
        localStorage.removeItem(KEY);
      });
    }
  })();
})();

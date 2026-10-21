/* Qboltz — Concept UI (Figma 713:6687)
   1. Frames 1–5 share one screen. Each scroll step fades to black, swaps the frame
      and fades back in. Frame 1 plays the intro video once and holds its last frame.
   2. After frame 5 the page scrolls normally. Frames 6–8 are three states of one
      sticky section: the cards slide with the scroll position.
   3. Every button gets the letter-by-letter hover from the Wedge reference. */
(function () {
  "use strict";

  var DESIGN_W = 1440;
  var DESIGN_H = 820;

  var root = document.documentElement;
  var body = document.body;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(v) { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); }

  /* ---------- sizing ---------- */

  function fit() {
    var w = root.clientWidth;
    var h = window.innerHeight;
    root.style.setProperty("--k", Math.min(w / DESIGN_W, h / DESIGN_H).toFixed(5));
    root.style.setProperty("--K", Math.max(w / DESIGN_W, h / DESIGN_H).toFixed(5));
  }
  fit();
  window.addEventListener("resize", fit);

  /* ---------- hover: letters dip one after another ---------- */

  Array.prototype.forEach.call(document.querySelectorAll("[data-hover-text]"), function (el) {
    var trigger = el.closest("a, button") || el;
    if (!trigger.hasAttribute("aria-label")) {
      trigger.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    }

    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    var i = 0;
    var last = null;
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      Array.from(node.textContent).forEach(function (ch) {
        if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); return; }
        var s = document.createElement("span");
        s.className = "ch";
        s.setAttribute("aria-hidden", "true");
        s.style.setProperty("--i", i++);
        s.textContent = ch;
        frag.appendChild(s);
        last = s;
      });
      node.parentNode.replaceChild(frag, node);
    });

    trigger.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "touch") return;
      el.classList.remove("is-flicker");
      void el.offsetWidth; // restart the animation
      el.classList.add("is-flicker");
    });
    if (last) {
      last.addEventListener("animationend", function () { el.classList.remove("is-flicker"); });
    }
  });

  /* ---------- intro: frames 1–5 through black ---------- */

  var intro = document.querySelector(".intro");
  var scenes = Array.prototype.slice.call(intro.querySelectorAll(".scene"));
  var veil = intro.querySelector(".intro__veil");
  var video = intro.querySelector(".scene__video");
  var LAST = scenes.length - 1;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var OUT_MS = reduced ? 1 : 450;
  var IN_MS = reduced ? 1 : 650;

  var current = 0;
  var busy = false;

  function setScene(n) {
    scenes.forEach(function (s, i) { s.classList.toggle("is-active", i === n); });
    current = n;
    body.setAttribute("data-scene", String(n));
    if (n === 0 && video) {
      try { video.currentTime = 0; } catch (err) { /* not loaded yet */ }
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    }
  }

  function veilTo(from, to, ms, easing) {
    return new Promise(function (resolve) {
      if (!veil.animate) { veil.style.opacity = to; resolve(); return; }
      var a = veil.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing: easing, fill: "forwards" });
      a.onfinish = resolve;
    });
  }

  function go(n) {
    if (busy || n === current || n < 0 || n > LAST) return Promise.resolve();
    busy = true;
    return veilTo(0, 1, OUT_MS, "cubic-bezier(0.4, 0, 1, 1)")
      .then(function () {
        setScene(n);
        return veilTo(1, 0, IN_MS, "cubic-bezier(0, 0, 0.2, 1)");
      })
      .then(function () { busy = false; });
  }

  function atTop() { return window.scrollY <= 2; }

  // One wheel/touch gesture moves one frame. Trackpads keep sending decaying inertia
  // events after the swipe, so a new step needs a pause or a clear new push.
  var lastWheelAt = 0;
  var lastWheelAbs = 0;
  var gestureUsed = false;

  window.addEventListener("wheel", function (e) {
    var now = performance.now();
    var dy = e.deltaY;
    var abs = Math.abs(dy);
    var fresh = now - lastWheelAt > 300 || (abs > 20 && abs > lastWheelAbs * 1.6 + 10);
    lastWheelAt = now;
    lastWheelAbs = abs;
    if (fresh) gestureUsed = false;

    if (!atTop()) { gestureUsed = true; return; }
    if (abs < 1 || e.ctrlKey) return;

    if (dy > 0) {
      if (current < LAST || busy || gestureUsed) {
        e.preventDefault();
        if (!busy && !gestureUsed && current < LAST) { gestureUsed = true; go(current + 1); }
      }
    } else if (current > 0) {
      e.preventDefault();
      if (!busy && !gestureUsed) { gestureUsed = true; go(current - 1); }
    }
  }, { passive: false });

  var touchY = null;
  var touchUsed = false;
  window.addEventListener("touchstart", function (e) {
    touchY = e.touches[0].clientY;
    touchUsed = false;
  }, { passive: true });
  window.addEventListener("touchmove", function (e) {
    if (touchY === null || !atTop()) return;
    var dy = touchY - e.touches[0].clientY;
    if (dy > 0 && (current < LAST || busy || touchUsed)) {
      e.preventDefault();
      if (!busy && !touchUsed && current < LAST && dy > 40) { touchUsed = true; go(current + 1); }
    } else if (dy < 0 && current > 0) {
      e.preventDefault();
      if (!busy && !touchUsed && dy < -40) { touchUsed = true; go(current - 1); }
    }
  }, { passive: false });
  window.addEventListener("touchend", function () { touchY = null; }, { passive: true });

  window.addEventListener("keydown", function (e) {
    if (!atTop() || e.altKey || e.ctrlKey || e.metaKey) return;
    var down = e.key === "ArrowDown" || e.key === "PageDown" || (e.key === " " && !e.shiftKey);
    var up = e.key === "ArrowUp" || e.key === "PageUp" || (e.key === " " && e.shiftKey);
    if (down && (current < LAST || busy)) { e.preventDefault(); go(current + 1); }
    else if (up && current > 0) { e.preventDefault(); go(current - 1); }
  });

  // Scrollbar drags, anchors and restored scroll positions skip straight to frame 5
  function syncIntro() {
    if (!atTop() && current !== LAST && !busy) setScene(LAST);
  }

  /* ---------- features: frames 6–8 ---------- */

  var features = document.querySelector(".features");
  var cards = Array.prototype.slice.call(features.querySelectorAll(".card"));
  var progress = features.querySelector(".progress");
  var badge = features.querySelector(".badge__num");
  var STEP = 298;              // card 304 wide, −6 overlap
  var LINE = 199.5;            // progress line per card (Frame 6: 199.5, Frame 8: 399)
  var HOLD_IN = 0.1;           // share of the section scroll spent before the first move
  var HOLD_OUT = 0.15;         // and after the last one
  var maxP = cards.length - 1;
  var target = 0;
  var shown = -1;
  var rafId = 0;

  function sectionRange() {
    var top = features.getBoundingClientRect().top + window.scrollY;
    return { top: top, len: features.offsetHeight - window.innerHeight };
  }

  function readScroll() {
    var r = sectionRange();
    var t = clamp((window.scrollY - r.top) / r.len, 0, 1);
    target = clamp((t - HOLD_IN) / (1 - HOLD_IN - HOLD_OUT), 0, 1) * maxP;
  }

  function render(p) {
    cards.forEach(function (card, i) {
      var d = i - p;
      var x = STEP * d;
      var opacity, line, fill, title, desc, mask;
      if (d >= 0) {
        // d = 0 is the card in the blue corners, d ≥ 1 waits on the right
        // (Frame 7: a third of the way in, title and text are already fully lit)
        var a = clamp(1 - d, 0, 1);
        var lit = smooth(a / 0.33);
        opacity = 0.5 + 0.5 * a;
        line = 0.16 * a;
        fill = 0.08 * (1 - a);
        title = 0.6 + 0.4 * lit;
        desc = 0.7 * lit;
        mask = 0;
      } else {
        // leaving to the left: fades from its left edge (Frame 7)
        var b = clamp(-d, 0, 1);
        mask = clamp(b * 2.5, 0, 1);
        opacity = 1 - smooth((b - 0.5) / 0.5);
        line = 0.16;
        fill = 0;
        title = 1;
        desc = 0.7 * (1 - mask);
      }
      card.style.transform = "translate3d(" + x.toFixed(2) + "px,0,0)";
      card.style.opacity = opacity.toFixed(3);
      card.style.setProperty("--card-line", line.toFixed(3));
      card.style.setProperty("--card-fill", fill.toFixed(3));
      card.querySelector(".card__title").style.opacity = title.toFixed(3);
      card.querySelector(".card__desc span").style.opacity = desc.toFixed(3);
      var m = mask > 0
        ? "linear-gradient(270deg, #000 0%, rgba(0,0,0," + (1 - mask).toFixed(3) + ") 86.43%)"
        : "none";
      card.style.webkitMaskImage = m;
      card.style.maskImage = m;
      var active = Math.round(p) === i;
      card.setAttribute("aria-current", active ? "true" : "false");
      card.tabIndex = Math.abs(d) < 1.5 ? 0 : -1;
    });

    progress.style.width = (LINE * (1 + p)).toFixed(2) + "px";

    var num = Math.min(cards.length, Math.ceil(p - 0.001) + 1);
    if (num !== shown) {
      shown = num;
      badge.textContent = (num < 10 ? "0" : "") + num;
    }
  }

  var currentP = 0;
  function tick() {
    var diff = target - currentP;
    currentP = Math.abs(diff) < 0.0005 ? target : currentP + diff * 0.14;
    render(currentP);
    rafId = currentP === target ? 0 : requestAnimationFrame(tick);
  }
  function kick() { if (!rafId) rafId = requestAnimationFrame(tick); }

  function scrollToCard(i) {
    var r = sectionRange();
    var t = HOLD_IN + (i / maxP) * (1 - HOLD_IN - HOLD_OUT);
    window.scrollTo({ top: r.top + r.len * t, behavior: reduced ? "auto" : "smooth" });
  }

  cards.forEach(function (card, i) {
    card.addEventListener("click", function () { scrollToCard(i); });
  });

  function onScroll() {
    syncIntro();
    readScroll();
    kick();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  /* ---------- in-page links ---------- */

  Array.prototype.forEach.call(document.querySelectorAll("[data-goto]"), function (link) {
    link.addEventListener("click", function (e) {
      var to = link.getAttribute("data-goto");
      e.preventDefault();
      if (/^\d+$/.test(to)) {
        var n = +to;
        if (atTop()) { go(n); return; }
        // jump back to the top behind the veil, then land on the frame
        busy = true;
        veilTo(0, 1, OUT_MS, "ease-in").then(function () {
          window.scrollTo(0, 0);
          setScene(n);
          return veilTo(1, 0, IN_MS, "ease-out");
        }).then(function () { busy = false; });
        return;
      }
      if (current !== LAST && atTop()) setScene(LAST);
      if (to === "contact") { scrollToCard(maxP); return; }
      var r = sectionRange();
      window.scrollTo({ top: r.top, behavior: reduced ? "auto" : "smooth" });
    });
  });

  /* ---------- start ---------- */

  // decode the hidden frames up front so switching to them doesn't stall a swipe
  Array.prototype.forEach.call(document.querySelectorAll(".scene img"), function (img) {
    if (img.decode) img.decode().catch(function () {});
  });

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);
  setScene(0);
  onScroll();
  render(0);
})();

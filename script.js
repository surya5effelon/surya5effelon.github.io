import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCa67Iw7eJVu6T7irC1FDcTOjUxFSBSQLQ",
  authDomain: "buttonproject-94329.firebaseapp.com",
  databaseURL: "https://buttonproject-94329-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "buttonproject-94329",
  storageBucket: "buttonproject-94329.firebasestorage.app",
  messagingSenderId: "609294851204",
  appId: "1:609294851204:web:4ed21c18175a1eec5cf6d1"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const buttons = [
    { el: document.getElementById("upBtn"),    path: "control/UP" },
    { el: document.getElementById("downBtn"),  path: "control/DOWN" },
    { el: document.getElementById("enterBtn"), path: "control/ENTER_SET" },
    { el: document.getElementById("menuBtn"),  path: "control/MENU_BACK" },
];

// Keep the buttons visually in sync if the value changes from elsewhere
// (e.g. the ESP32 itself, or another browser/tab) without re-writing the DB.
const controlRef = ref(db, "control");

onValue(controlRef, (snapshot) => {

    const data = snapshot.val();

    if (!data) return;

    const stateMap = {
        "control/UP": data.UP,
        "control/DOWN": data.DOWN,
        "control/ENTER_SET": data.ENTER_SET,
        "control/MENU_BACK": data.MENU_BACK
    };

    buttons.forEach(({ el, path }) => {
        el.classList.toggle("pressed", stateMap[path] == 1);
    });

});

function press(el, path) {

    if (el.classList.contains("pressed")) return;

    el.classList.add("pressed");
    set(ref(db, path), 1);

}

function release(el, path) {

    if (!el.classList.contains("pressed")) return;

    el.classList.remove("pressed");
    set(ref(db, path), 0);

}

buttons.forEach(({ el, path }) => {

    // Pointer events cover mouse, touch, and stylus in one set of handlers.
    el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        press(el, path);
    });

    el.addEventListener("pointerup", () => release(el, path));
    el.addEventListener("pointerleave", () => release(el, path));
    el.addEventListener("pointercancel", () => release(el, path));

    // Prevent the press from sticking if focus is lost mid-press (e.g. alt-tab).
    el.addEventListener("blur", () => release(el, path));

});


// ---------------------------------------------------------------
//  Display panel: dig1..dig6 -> 7-segment digits, dig7 -> status LEDs
// ---------------------------------------------------------------

// Flip this if every segment reads inverted (i.e. the hardware is wired so
// that a logic LOW means "lit").
const INVERT_SEGMENTS = false;

// Each dig<n> is 8 booleans. Index 0..7 maps to a, b, c, d, e, f, g, dp.
const SEG_ORDER = ["a", "b", "c", "d", "e", "f", "g", "dp"];

// dig7 carries the status LEDs on indices 0..6. Index 7 is unused.
const STATUS_LEDS = [
    { label: "Low Limit / Reverse",  color: "#ffb020" },
    { label: "Auto",                 color: "#4CAF50" },
    { label: "Output Hi / Low",      color: "#29b6f6" },
    { label: "Manual",               color: "#ab7df6" },
    { label: "Overload",             color: "#ff3b30" },
    { label: "Mains",                color: "#4CAF50" },
    { label: "High Limit / Forward", color: "#ffb020" }
];

const DIGIT_SVG = `
<svg class="seg-digit" viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(12,0) skewX(-6)">
    <polygon class="seg" data-seg="a" points="14,16 21,9 79,9 86,16 79,23 21,23"/>
    <polygon class="seg" data-seg="b" points="88,22 95,29 95,77 88,84 81,77 81,29"/>
    <polygon class="seg" data-seg="c" points="88,96 95,103 95,151 88,158 81,151 81,103"/>
    <polygon class="seg" data-seg="d" points="14,164 21,157 79,157 86,164 79,171 21,171"/>
    <polygon class="seg" data-seg="e" points="12,96 19,103 19,151 12,158 5,151 5,103"/>
    <polygon class="seg" data-seg="f" points="12,22 19,29 19,77 12,84 5,77 5,29"/>
    <polygon class="seg" data-seg="g" points="14,90 21,83 79,83 86,90 79,97 21,97"/>
    <circle  class="seg" data-seg="dp" cx="105" cy="164" r="8"/>
  </g>
</svg>`;

const segRow  = document.getElementById("segRow");
const ledGrid = document.getElementById("ledGrid");

segRow.innerHTML = DIGIT_SVG.repeat(6);
const digitEls = Array.from(segRow.querySelectorAll(".seg-digit"));

ledGrid.innerHTML = STATUS_LEDS.map(({ label, color }) => `
  <div class="led-item" style="--led-color:${color}">
    <span class="led-dot"></span>
    <span class="led-label">${label}</span>
  </div>`).join("");
const ledEls = Array.from(ledGrid.querySelectorAll(".led-item"));

// The Pico writes booleans, but be lenient about how they come back.
const isOn = (v) => v === true || v === 1 || v === "1";

function renderDigit(digitEl, bits) {

    SEG_ORDER.forEach((name, i) => {

        // No data for this digit -> blank it rather than inverting to "all on".
        let lit = false;
        if (bits) lit = INVERT_SEGMENTS ? !isOn(bits[i]) : isOn(bits[i]);

        digitEl.querySelector(`[data-seg="${name}"]`).classList.toggle("on", lit);

    });

}

function renderStatus(bits) {

    ledEls.forEach((el, i) => {
        el.classList.toggle("on", bits ? isOn(bits[i]) : false);
    });

}

// Firebase collapses contiguous "0".."7" keys into an array, and leaves it as
// an object if any index is missing. bits[i] indexes both the same way.
const displayRef = ref(db, "display");

onValue(displayRef, (snapshot) => {

    const data = snapshot.val() || {};

    digitEls.forEach((el, i) => renderDigit(el, data["dig" + (i + 1)]));

    renderStatus(data.dig7);

});

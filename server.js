// server.js
// Minimal Express API with the exact endpoint you need:
// POST /api/court/availability/check  (body: { courtId, date, timeSlot })

const express = require("express");
const app = express();
app.use(express.json());

// --- Health check (handy to confirm server is running)
app.get("/", (_req, res) => res.json({ ok: true, message: "API running" }));

/* ---------------------------------------------------------
   Demo data (in-memory)
   - Two courts with open hours
   - One seeded booking to demo a 409 overlap
--------------------------------------------------------- */
const COURTS = [
  { id: "C001", open: "08:00", close: "22:00" },
  { id: "C002", open: "09:00", close: "21:00" }
];

// bookings[courtId][date] = [{ start, end }]
const COURT_BOOKINGS = {
  C001: {
    "2025-10-09": [{ start: "14:00", end: "15:00" }] // seeded overlap slot
  }
};

/* ---------------------------------------------------------
   Helpers (prefixed to avoid any future name collisions)
--------------------------------------------------------- */
function cToMinutes(t) {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
}
function cToTime(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}
function cIsISODate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
}
function cIsValidSlot(s) {
  // HH:mm-HH:mm (24h)
  return /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(s);
}
function cParseSlot(s) {
  const [startStr, endStr] = s.split("-");
  const start = cToMinutes(startStr);
  const end = cToMinutes(endStr);
  return { startStr, endStr, start, end };
}
function cIsPastDate(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return d < today;
}

/* ---------------------------------------------------------
   Endpoint: Check court availability
   Method + Path: POST /api/court/availability/check
   Request body:
     {
       "courtId": "C001",
       "date": "YYYY-MM-DD",
       "timeSlot": "HH:mm-HH:mm"
     }
   Notes:
   - Only 1-hour time slots allowed
   - No past dates
   - Must be within court open hours
   - Returns 409 if the slot overlaps an existing booking
   - Extra fields in the request (e.g., isAvailable, message) are ignored
--------------------------------------------------------- */
app.post("/api/court/availability/check", (req, res) => {
  try {
    const { courtId, date, timeSlot } = req.body || {};

    // 400 / 422 — basic validation
    if (!courtId || !date || !timeSlot) {
      return res.status(400).json({
        message: "Invalid request. Please provide courtId, date, and timeSlot."
      });
    }
    if (!cIsISODate(date) || !cIsValidSlot(timeSlot)) {
      return res.status(422).json({
        message: "Invalid request. date must be YYYY-MM-DD and timeSlot must be HH:mm-HH:mm."
      });
    }
    if (cIsPastDate(date)) {
      return res.status(422).json({ message: "Date cannot be in the past." });
    }

    // 404 — court not found
    const court = COURTS.find(c => c.id === courtId);
    if (!court) return res.status(404).json({ message: "Court ID not found." });

    // 1-hour slot + open hours enforcement
    const { startStr, endStr, start, end } = cParseSlot(timeSlot);
    if (end - start !== 60) {
      return res.status(422).json({ message: "Only 1-hour time slots are allowed." });
    }
    const open = cToMinutes(court.open), close = cToMinutes(court.close);
    if (start < open || end > close) {
      return res.status(422).json({
        message: `Requested time is outside open hours (${court.open}-${court.close}).`
      });
    }

    // 409 — overlap check
    const day = (COURT_BOOKINGS[courtId] && COURT_BOOKINGS[courtId][date]) || [];
    const overlap = day.some(b => !(end <= cToMinutes(b.start) || start >= cToMinutes(b.end)));
    if (overlap) {
      return res.status(409).json({ message: "Court is not available at the requested time." });
    }

    // 200 — success
    return res.json({
      courtId,
      date,
      timeSlot: `${startStr}-${endStr}`,
      isAvailable: true,
      message: "Court is available for booking."
    });
  } catch (e) {
    console.error("court availability error:", e);
    return res.status(500).json({ message: "Something went wrong." });
  }
});

/* ---------------------------------------------------------
   Start server
--------------------------------------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));

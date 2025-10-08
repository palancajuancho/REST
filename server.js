// ===== Court Availability =====

// (A) sample courts + seeded bookings for demo
const courts = [
  { id: "C001", open: "08:00", close: "22:00" },
  { id: "C002", open: "09:00", close: "21:00" }
];

// in-memory: bookings[courtId][date] = [{ start, end }]
const bookings = {
  C001: {
    // seed an existing booking so you can demo the 409 overlap
    "2025-10-09": [{ start: "14:00", end: "15:00" }]
  }
};

// (B) helpers
function toMinutes(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function toTime(mins) { const h = String(Math.floor(mins / 60)).padStart(2, "0"); const m = String(mins % 60).padStart(2, "0"); return `${h}:${m}`; }

function isISODate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
}

function isValidSlot(s) {
  // HH:mm-HH:mm (24h)
  return /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function parseSlot(s) {
  const [startStr, endStr] = s.split("-");
  const start = toMinutes(startStr);
  const end = toMinutes(endStr);
  return { startStr, endStr, start, end };
}

function isPastDate(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return d < today;
}

// (C) route
app.post("/api/court/availability/check", (req, res) => {
  try {
    const { courtId, date, timeSlot } = req.body || {};

    // 400 / 422 — basic field validation
    if (!courtId || !date || !timeSlot) {
      return res.status(400).json({
        message: "Invalid request. Please provide courtId, date, and timeSlot."
      });
    }
    if (!isISODate(date) || !isValidSlot(timeSlot)) {
      return res.status(422).json({
        message: "Invalid request. date must be YYYY-MM-DD and timeSlot must be HH:mm-HH:mm."
      });
    }
    if (isPastDate(date)) {
      return res.status(422).json({ message: "Date cannot be in the past." });
    }

    // 404 — court not found
    const court = courts.find(c => c.id === courtId);
    if (!court) return res.status(404).json({ message: "Court ID not found." });

    // derive minutes, enforce 1-hour rule and open hours
    const { startStr, endStr, start, end } = parseSlot(timeSlot);
    if (end - start !== 60) {
      return res.status(422).json({ message: "Only 1-hour time slots are allowed." });
    }
    const open = toMinutes(court.open), close = toMinutes(court.close);
    if (start < open || end > close) {
      return res.status(422).json({
        message: `Requested time is outside open hours (${court.open}-${court.close}).`
      });
    }

    // 409 — overlap
    const day = (bookings[courtId] && bookings[courtId][date]) || [];
    const hasOverlap = day.some(b => !(end <= toMinutes(b.start) || start >= toMinutes(b.end)));
    if (hasOverlap) {
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
    // 500 — unexpected
    return res.status(500).json({ message: "Something went wrong." });
  }
});


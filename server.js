// server.js
// Courtify Mini API: availability check + booking estimate
// Run: npm install && npm start  → http://localhost:3000

const express = require('express');
const app = express();
app.use(express.json());

// ---- In-memory data (tiny seed) ----
const facilities = {
  'courtify-sportsplex': {
    id: 'courtify-sportsplex',
    name: 'Courtify Sportsplex',
    hourlyRate: 500, // PHP/hour
    open: { start: '08:00', end: '22:00' },
    // Example bookings to demonstrate conflicts
    bookings: {
      '2025-10-10': [ { start: '10:00', end: '11:30' } ],
      '2025-10-11': [ { start: '15:00', end: '16:00' } ]
    }
  }
};

// ---- Helpers ----
function toMinutes(hhmm) {
  const [h, m] = (hhmm || '').split(':').map(Number);
  return h * 60 + m;
}
function isValidDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isValidTime(s) {
  if (!/^\d{2}:\d{2}$/.test(s)) return false;
  const [h, m] = s.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
function fmt(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// ---- Endpoints ----

// POST /api/availability/check
app.post('/api/availability/check', (req, res, next) => {
  try {
    const { facilityId, date, startTime, durationMinutes } = req.body || {};

    if (!facilityId || typeof facilityId !== 'string') {
      return res.status(400).json({ message: 'facilityId is required' });
    }
    if (!date || !isValidDate(date)) {
      return res.status(400).json({ message: 'date must be YYYY-MM-DD' });
    }
    if (!startTime || !isValidTime(startTime)) {
      return res.status(400).json({ message: 'startTime must be HH:MM' });
    }
    const dur = Number(durationMinutes);
    if (!Number.isInteger(dur) || dur < 30) {
      return res.status(400).json({ message: 'durationMinutes must be integer ≥ 30' });
    }

    const fac = facilities[facilityId];
    if (!fac) return res.status(404).json({ message: 'facility not found' });

    const openStart = toMinutes(fac.open.start);
    const openEnd   = toMinutes(fac.open.end);
    const start     = toMinutes(startTime);
    const end       = start + dur;

    if (start < openStart || end > openEnd) {
      return res.status(422).json({ message: `Requested time outside open hours ${fac.open.start}-${fac.open.end}` });
    }

    const dayBookings = fac.bookings[date] || [];
    const conflict = dayBookings.find(b =>
      overlaps(start, end, toMinutes(b.start), toMinutes(b.end))
    );

    const response = {
      facilityId,
      date,
      startTime,
      endTime: fmt(end),
      isAvailable: !conflict
    };

    if (conflict) {
      response.conflict = conflict;

      // Suggest next available slot with same duration (same day)
      const slots = dayBookings.slice().sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
      let cur = Math.max(start, openStart);
      for (const b of slots) {
        const bs = toMinutes(b.start), be = toMinutes(b.end);
        if (cur + dur <= bs) {
          response.nextAvailable = { startTime: fmt(cur), endTime: fmt(cur + dur) };
          return res.json(response);
        }
        cur = Math.max(cur, be);
      }
      if (cur + dur <= openEnd) {
        response.nextAvailable = { startTime: fmt(cur), endTime: fmt(cur + dur) };
      }
    }

    return res.json(response);
  } catch (err) {
    next(err);
  }
});

// POST /api/booking/estimate
app.post('/api/booking/estimate', (req, res, next) => {
  try {
    const { facilityId, durationMinutes } = req.body || {};
    if (!facilityId || typeof facilityId !== 'string') {
      return res.status(400).json({ message: 'facilityId is required' });
    }
    const dur = Number(durationMinutes);
    if (!Number.isInteger(dur) || dur < 30) {
      return res.status(400).json({ message: 'durationMinutes must be integer ≥ 30' });
    }

    const fac = facilities[facilityId];
    if (!fac) return res.status(404).json({ message: 'facility not found' });

    const estimatedPrice = +(fac.hourlyRate * (dur / 60)).toFixed(2);
    return res.json({
      facilityId,
      hourlyRate: fac.hourlyRate,
      durationMinutes: dur,
      estimatedPrice,
      currency: 'PHP'
    });
  } catch (err) {
    next(err);
  }
});

// JSON-only error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Courtify Mini API running at http://localhost:${PORT}`);
});

# Tests (Happy + Error)

## Happy (availability is free)
curl -s -X POST http://localhost:3000/api/availability/check \
  -H "Content-Type: application/json" \
  -d '{ "facilityId":"courtify-sportsplex", "date":"2025-10-10", "startTime":"09:00", "durationMinutes":60 }' | jq .

## Error (missing facilityId → 400)
curl -s -X POST http://localhost:3000/api/availability/check \
  -H "Content-Type: application/json" \
  -d '{ "date":"2025-10-10", "startTime":"09:00", "durationMinutes":60 }' | jq .

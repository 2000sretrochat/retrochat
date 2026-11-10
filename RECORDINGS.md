# Master room recordings

Masters only (DB `users.is_master`). Everyone else gets 403 from the API and never downloads the recorder code.

## How it works
- **Recording happens on the master's own device** (`master-recorder.js`, served only via `/api/master/recorder.js`).
  It records the streams that browser/Messenger already receives in the room, so it adds no server or TURN cost.
  - Audio only: every remote voice (`<audio id="au…">`) plus the master's own mic, mixed with WebAudio (soft-limited).
  - Video only: the webcams the master has open in the cam strip, composited into one 1280x720 grid (15 fps) with name labels.
  - Both: the grid + the mixed audio in one `.webm` (VP8 + Opus).
- **Saving**: Razzle Messenger (desktop) streams the file to `Documents/Razzle Recordings/` while it records
  (needs the next Messenger installer; older installs fall back to a normal download). Browsers download the `.webm` when you stop.
- **Server** (`recordings.js`): start/stop sessions, room-wide `rec` flag (`{ room, on }`) for the amber dot,
  `history.rec` for people who join later, auto-stop when the master leaves the room / switches rooms / disconnects
  (the recorder gets `rec:ended` and saves what it has), and a metadata log in `recording_sessions`.

## API
- Socket: `rec:start {mode: 'audio'|'video'|'both'}`, `rec:stop {id, bytes}`; broadcasts `rec`; sends `rec:ended` to the recorder.
- HTTP (masters only, 401 signed out, 403 non-masters): `GET /api/recordings` (past sessions),
  `GET /api/recordings/state?room=`, `POST /api/recordings/start {mode}` (master must be in a room), `POST /api/recordings/stop {id}`.

## Optional server upload (designed, NOT enabled)
Render's free disk is wiped on every deploy/restart and Neon (Postgres) is not meant for video blobs.
If server copies are ever wanted, the free-friendly option is Cloudflare R2 (10 GB storage free, no egress fees):
the server would hand the master a short-lived presigned PUT URL and the browser uploads directly to R2, so the
video never passes through Render. Not built; needs an R2 bucket + keys.

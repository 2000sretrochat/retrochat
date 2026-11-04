# ChatBabble Social messenger integration

This branch adds `/social/` to the existing Express app. `/` remains the original
messenger and `/rooms.html` remains the original room app. No database migration
or new package is required. Do not move the Social files onto an unrelated host:
they intentionally use the existing same-origin session cookie and security policy.

## What works in this change

- `/social/` serves the approved Social design, with a same-origin messenger dock.
- The dock loads a dedicated, reskinned copy of the existing messenger. It uses
  the actual account, buddy requests, online/offline groups, messages, and media code.
- Hide closes the panel visually, without signing out. The Messenger menu still
  provides Sign Out. Open full messenger opens the unchanged standalone app.
- Opening private messages, room browsing, or a modal expands the dock; closing
  them returns it to the narrow column.
- Following remains distinct from an accepted messenger contact request.
- One Social connection and one standalone/desktop messenger connection can coexist.
  Opening another of the same category retains the existing replacement behavior.
- Calls ring one endpoint, preferring the standalone messenger when it is present.
  Answer, signaling, and hangup stay pinned to those windows. Disconnect ends a call.

## Deliberate limitations

The Social feed, photos, follows, and comments are still browser-local previews,
not shared social records. They are labeled accordingly and scoped by signed-in alias.
Example posts/profiles do not represent live users. This does not implement a social
database, public feed, shared follows, or server-side photo uploads.

The two messenger windows can both display incoming messages/notifications. Calls
are routed to one endpoint. Offline messages are consumed by whichever initializes
first, matching the existing queue semantics. Incoming call routing is in memory,
like the existing presence system; this is not a multi-server signaling service.

## Validation

Run `node --test test/messenger-sessions.test.js test/social-messenger.test.js`.
The tests cover independent session categories, replacements, authentication,
single-endpoint calls, answer ownership, signal routing, decline/disconnect cleanup,
and timeout recovery. The account-handler tests use a fake database and Socket.IO
surface, not a running Postgres instance.

Before merging/deploying, open `/social/` on an isolated staging instance using a
test database. Verify sign-in, accepted and declined contact requests, text/typing,
presence changes, hide/reopen, small-screen dialogs, desktop coexistence, and real
voice/video across two test accounts. Review server cookies and media permissions
through the existing same-origin policy. No production accounts were used for tests.

The current Sites preview remains a separate local-data design demo. This branch
is not deployed to the existing Render service until it is merged/deployed there.

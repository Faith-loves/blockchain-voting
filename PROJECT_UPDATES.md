# Project Updates Documentation

This document summarizes everything that was added, changed, and improved in the blockchain voting project during the recent work session.

## Overview

The project was expanded from a basic voting app into a more complete election management system with:

- stronger admin controls
- election scheduling and lifecycle management
- password recovery
- export and backup tools
- improved receipt verification feedback
- a richer admin dashboard and winners presentation

## Backend Changes

### 1. Authentication Improvements

Files:

- [server/index.js](./server/index.js)
- [server/models/User.js](./server/models/User.js)

What changed:

- Added `POST /api/auth/forgot-password`
- Added `POST /api/auth/reset-password`
- Added password reset token storage to the user model
- Login now supports either email or matric number
- Added CSRF handling for the new auth flows

What improved:

- Users can recover access without manual database edits
- The login experience now matches backend capability

Important note:

- The forgot-password flow is token-based for now.
- There is no email sender configured yet, so the system returns reset information directly instead of emailing it.

### 2. Election Activity Enforcement

Files:

- [server/index.js](./server/index.js)
- [server/models/Election.js](./server/models/Election.js)

What changed:

- Voting now checks whether the current election is actually active
- Voting now respects election `startsAt` and `endsAt`
- Support was added for `isCurrent`, `startsAt`, `endsAt`, and `archivedAt`

What improved:

- Elections can be opened, closed, scheduled, and archived properly
- Votes are blocked outside the active election window

### 3. Admin Management API

Files:

- [server/middleware/admin.js](./server/middleware/admin.js)

What changed:

- Added admin listing endpoint
- Added admin creation endpoint
- Added admin removal endpoint
- Added admin re-auth protection for sensitive actions

What improved:

- Admins can now manage other admin accounts directly from the UI
- Basic safeguards were added, including preventing removal of the last admin and preventing self-removal in unsafe ways

### 4. Election Management API

Files:

- [server/middleware/admin.js](./server/middleware/admin.js)
- [server/models/Election.js](./server/models/Election.js)
- [server/seed/currentElection.js](./server/seed/currentElection.js)

What changed:

- Added endpoint to update the current election
- Added endpoint to enable or disable the current election
- Added endpoint to archive the current election
- Added endpoint to create a new election and make it current
- Added support for election time windows and current-election tracking

What improved:

- The admin can now control the full election lifecycle from the dashboard
- Historical elections can be preserved while a new election becomes active

### 5. Audit, Report, and Backup Tools

Files:

- [server/middleware/admin.js](./server/middleware/admin.js)

What changed:

- Added audit CSV export
- Added election report CSV export
- Added full backup JSON export
- Added merge-mode backup restore

What improved:

- The system now has administrative data portability
- Election data can be reviewed, downloaded, archived, and restored

### 6. Receipt Verification and Vote Submission

Files:

- [server/index.js](./server/chain.js)
- [server/index.js](./server/index.js)

What changed:

- Vote submission continues to create receipt records
- Verification endpoints were kept aligned with receipt lookup
- Error messaging around receipt verification was improved on the frontend

What improved:

- Verification failures are easier to understand
- Contract deployment mismatch is now surfaced clearly instead of failing silently

## Frontend Changes

### 1. Routing Updates

Files:

- [client/src/App.jsx](./client/src/App.jsx)

What changed:

- Added `/forgot-password`
- Added `/reset-password`

What improved:

- Password recovery is now accessible from the app itself

### 2. Login and Registration Flow

Files:

- [client/src/pages/Login.jsx](./client/src/pages/Login.jsx)
- [client/src/pages/Register.jsx](./client/src/pages/Register.jsx)
- [client/src/pages/ForgotPassword.jsx](./client/src/pages/ForgotPassword.jsx)
- [client/src/pages/ResetPassword.jsx](./client/src/pages/ResetPassword.jsx)

What changed:

- Login now accepts email or matric number
- Added a forgot-password screen
- Added a reset-password screen
- Registration submit behavior was tightened and made clearer

What improved:

- The auth flow is more complete and more understandable
- Register and login errors are easier for users to interpret

### 3. Vote and Verify Flow

Files:

- [client/src/pages/Vote.jsx](./client/src/pages/Vote.jsx)
- [client/src/pages/VerifyReceipt.jsx](./client/src/pages/VerifyReceipt.jsx)

What changed:

- Fixed the `Verify Now` button to depend on `receiptId`
- Added a check for whether the voting contract actually exists at the configured address
- Improved verification status messaging

What improved:

- The verify action is more reliable after a vote is submitted
- Users now get useful status feedback such as:
  - missing contract deployment
  - database receipt found
  - chain receipt missing

### 4. Admin Panel Redesign

Files:

- [client/src/pages/AdminPanel.jsx](./client/src/pages/AdminPanel.jsx)

What changed:

- Reworked the admin page into a multi-section control center
- Added tabs for:
  - Winners
  - Overview
  - Manage Ballot
  - Schedule
  - Admins
  - History
  - Tools

What improved:

- The admin experience is now much broader and more formal
- Key election controls are grouped into clearer sections

### 5. Winners Experience

Files:

- [client/src/pages/AdminPanel.jsx](./client/src/pages/AdminPanel.jsx)

What changed:

- Added a dedicated winners page before the overview
- Styled the winners page with a more polished presentation
- Added the trophy icon back into the winners cards
- Added tie handling so two first-place candidates appear together when tied

What improved:

- The winners page now communicates results more clearly
- Tie situations are represented properly instead of hiding one candidate

### 6. Downloads and Restore UI

Files:

- [client/src/pages/AdminPanel.jsx](./client/src/pages/AdminPanel.jsx)

What changed:

- Added report download button
- Added audit CSV download button
- Added backup JSON download button
- Added backup restore input
- Restored the missing `saveBlob` helper used by downloads

What improved:

- Admin exports now work directly in the browser
- Restore operations can be started from the panel instead of by code edits

## Data Model Changes

### User Model

File:

- [server/models/User.js](./server/models/User.js)

Added fields:

- `resetPasswordTokenHash`
- `resetPasswordExpiresAt`

### Election Model

File:

- [server/models/Election.js](./server/models/Election.js)

Added fields:

- `isCurrent`
- `startsAt`
- `endsAt`
- `archivedAt`

Added indexes:

- current/archive lookup index
- schedule lookup index

## New Features Available to Admins

Admins can now:

- add a new admin
- remove an admin
- update the current election
- set election start and end times
- enable or disable an election
- archive an election
- create a new election
- review election history
- export audit logs
- export an election report
- export a full backup
- restore backup data in merge mode
- view winners in a more polished dedicated page

## Workspace and Script Improvements

File:

- [package.json](./package.json)

What changed:

- Added root workspace scripts for:
  - installing all packages
  - running client
  - running server
  - running chain
  - building the client
  - deploying the chain
  - running chain tests

What improved:

- Local development setup is simpler and more consistent

## Verification and Build Checks Completed

The updated project was checked with:

- `node --check server/index.js`
- `node --check server/middleware/admin.js`
- `npm run build` in `client`

These checks confirmed that the updated backend files parse correctly and the frontend builds successfully.

## Known Limitations Still Remaining

These items are still not fully solved:

- no email delivery service for forgot-password
- no full email verification flow
- blockchain verification still depends on correct Hardhat deployment and matching contract address
- local blockchain resets still invalidate old contract addresses
- no full CI/CD deployment pipeline yet
- contract tests are still limited and should be expanded

## Recommended Next Steps

1. Add real email delivery for password reset and verification
2. Move contract address configuration fully into environment variables
3. Add backend and contract automated tests
4. Add deployment configuration for production hosting
5. Decide whether blockchain voting should remain receipt-based or become fully on-chain

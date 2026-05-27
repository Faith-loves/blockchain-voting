# DCC Documentation

## Project Name

DCC

## Project Summary

DCC is a blockchain-supported voting platform built with:

- React and Vite for the frontend
- Express and MongoDB for the backend
- Hardhat and Solidity for blockchain receipt recording and verification

The platform supports voter registration, login, election voting, receipt verification, and full admin-side election management.

## Core System Areas

### Frontend

Location:

- [client](c:/Users/HP/Desktop/blockchain-voting/client)

Main responsibilities:

- user registration and login
- ballot display and vote submission
- vote receipt viewing and verification
- admin dashboard and election controls

### Backend

Location:

- [server](c:/Users/HP/Desktop/blockchain-voting/server)

Main responsibilities:

- authentication
- voter and admin session handling
- election management
- vote storage
- receipt generation
- blockchain receipt recording
- exports, backup, and restore

### Blockchain

Location:

- [chain](c:/Users/HP/Desktop/blockchain-voting/chain)

Main responsibilities:

- deploy voting contract
- record receipt hashes on-chain
- support receipt verification

## Features Added

### Authentication

Added:

- forgot-password flow
- reset-password flow
- login with email or matric number

Files:

- [client/src/pages/ForgotPassword.jsx](c:/Users/HP/Desktop/blockchain-voting/client/src/pages/ForgotPassword.jsx)
- [client/src/pages/ResetPassword.jsx](c:/Users/HP/Desktop/blockchain-voting/client/src/pages/ResetPassword.jsx)
- [client/src/pages/Login.jsx](c:/Users/HP/Desktop/blockchain-voting/client/src/pages/Login.jsx)
- [server/index.js](c:/Users/HP/Desktop/blockchain-voting/server/index.js)
- [server/models/User.js](c:/Users/HP/Desktop/blockchain-voting/server/models/User.js)

### Admin Management

Added:

- create new admin
- remove admin
- list admins
- admin re-auth check for sensitive actions

Files:

- [client/src/pages/AdminPanel.jsx](c:/Users/HP/Desktop/blockchain-voting/client/src/pages/AdminPanel.jsx)
- [server/middleware/admin.js](c:/Users/HP/Desktop/blockchain-voting/server/middleware/admin.js)

### Election Management

Added:

- set election start time
- set election end time
- enable election
- disable election
- archive election
- create a new election
- track current election
- view election history

Files:

- [client/src/pages/AdminPanel.jsx](c:/Users/HP/Desktop/blockchain-voting/client/src/pages/AdminPanel.jsx)
- [server/middleware/admin.js](c:/Users/HP/Desktop/blockchain-voting/server/middleware/admin.js)
- [server/models/Election.js](c:/Users/HP/Desktop/blockchain-voting/server/models/Election.js)
- [server/seed/currentElection.js](c:/Users/HP/Desktop/blockchain-voting/server/seed/currentElection.js)

### Admin Tools

Added:

- audit export
- election report download
- backup export
- backup restore

Files:

- [client/src/pages/AdminPanel.jsx](c:/Users/HP/Desktop/blockchain-voting/client/src/pages/AdminPanel.jsx)
- [server/middleware/admin.js](c:/Users/HP/Desktop/blockchain-voting/server/middleware/admin.js)

### Verification Improvements

Changed:

- fixed the `Verify Now` button behavior
- improved receipt verification messaging
- added contract existence check before blockchain verification

Files:

- [client/src/pages/Vote.jsx](c:/Users/HP/Desktop/blockchain-voting/client/src/pages/Vote.jsx)
- [client/src/pages/VerifyReceipt.jsx](c:/Users/HP/Desktop/blockchain-voting/client/src/pages/VerifyReceipt.jsx)

### Winners and Admin UI

Changed:

- added a dedicated winners page before overview
- redesigned the overview into a more formal admin dashboard
- added trophy icon to winner cards
- added tie support to show both candidates when first place is tied

Files:

- [client/src/pages/AdminPanel.jsx](c:/Users/HP/Desktop/blockchain-voting/client/src/pages/AdminPanel.jsx)

## Data Model Improvements

### User Model

File:

- [server/models/User.js](c:/Users/HP/Desktop/blockchain-voting/server/models/User.js)

Added fields:

- `resetPasswordTokenHash`
- `resetPasswordExpiresAt`

### Election Model

File:

- [server/models/Election.js](c:/Users/HP/Desktop/blockchain-voting/server/models/Election.js)

Added fields:

- `isCurrent`
- `startsAt`
- `endsAt`
- `archivedAt`

## Improvements Made

### Security and Control

Improved:

- sensitive admin actions can require admin password confirmation
- vote submission now respects whether an election is active
- vote submission now respects election start and end time

### Usability

Improved:

- clearer login flow
- working export downloads
- more useful receipt verification statuses
- more complete admin workflow in one place

### Operations

Improved:

- election data can be downloaded as reports
- admin activity can be exported
- backups can be exported and restored

## Root Workspace Scripts

File:

- [package.json](c:/Users/HP/Desktop/blockchain-voting/package.json)

Added scripts:

- `install:all`
- `dev:client`
- `dev:server`
- `dev:chain`
- `build`
- `start`
- `deploy:chain`
- `test:chain`

## Running the Project

### 1. Start Hardhat

```powershell
cd c:\Users\HP\Desktop\blockchain-voting\chain
npx hardhat node
```

### 2. Deploy the Contract

```powershell
cd c:\Users\HP\Desktop\blockchain-voting\chain
npx hardhat run scripts/deploy.ts --network localhost
```

### 3. Start the Server

```powershell
cd c:\Users\HP\Desktop\blockchain-voting\server
npm start
```

### 4. Start the Client

```powershell
cd c:\Users\HP\Desktop\blockchain-voting\client
npm run dev
```

## Known Limitations

- forgot-password does not yet send real email
- contract address must match the active Hardhat deployment
- restarting Hardhat invalidates the previous local contract deployment
- production deployment automation is not yet fully set up

## Recommended Next Steps

1. Add email delivery for password reset
2. Move all deployment-sensitive values into environment variables
3. Add backend and contract automated tests
4. Set up production deployment for frontend and backend
5. Expand documentation for end users and admins

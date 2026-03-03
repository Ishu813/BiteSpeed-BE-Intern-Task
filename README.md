# Bitespeed Backend Task – Identity Reconciliation

This project is a Node.js + TypeScript + PostgreSQL implementation of the **Bitespeed Backend Task: Identity Reconciliation** described at [`https://bitespeed.notion.site/Bitespeed-Backend-Task-Identity-Reconciliation-1fb21bb2a930802eb896d4409460375c`](https://bitespeed.notion.site/Bitespeed-Backend-Task-Identity-Reconciliation-1fb21bb2a930802eb896d4409460375c?pvs=143).

The core requirement is an `/identify` endpoint that, given an `email` and/or `phoneNumber`, reconciles customer identities across multiple `Contact` rows and returns a consolidated view with a single **primary** contact and zero or more **secondary** contacts.

Backend URL : https://bitespeed-be-intern-task.onrender.com

## Tech stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express
- **Database**: PostgreSQL (`contacts` table)

## Project scripts

- `npm run dev` – start the server in development mode with auto-reload.
- `npm run build` – compile TypeScript to JavaScript in the `dist` folder.
- `npm start` – run the compiled server from `dist`.

## Running the server locally

1. Install dependencies:

```bash
npm install
```

2. Configure database connection in `.env`:

```bash
DATABASE_URL=postgres://username:password@host:5432/dbname
```

The app uses this URL to connect to PostgreSQL and will auto-create the `contacts` table on startup.

3. Start the dev server:

```bash
npm run dev
```

The server will start on `http://localhost:3000`.

## Data model

The `contacts` table matches the task specification:

- `id` – primary key
- `phoneNumber?` – optional phone number
- `email?` – optional email
- `linkedId?` – id of another `Contact` this one is linked to (for secondary contacts)
- `linkPrecedence` – `"primary"` or `"secondary"`
- `createdAt`, `updatedAt`, `deletedAt?` – timestamps

## `/identify` endpoint

- **Method**: `POST`
- **Path**: `/identify`
- **Body**:

```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "123456"
}
```

- At least one of `email` or `phoneNumber` is required. If both are missing, the endpoint returns **400**.

### Successful response shape

On success, the endpoint always returns **200** with:

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

- **primaryContactId**: id of the oldest `Contact` in the linked group.
- **emails**: distinct list of all emails in the group (primary email first if present).
- **phoneNumbers**: distinct list of all phone numbers in the group (primary phone first if present).
- **secondaryContactIds**: ids of all non-primary contacts in the group.

### Behaviour summary

- If there are **no existing contacts** matching the incoming `email` or `phoneNumber`, a new `Contact` is created with `linkPrecedence = "primary"` and returned as the only contact in the group.
- If there **are existing contacts**:
  - All related contacts (linked via shared email/phone or `linkedId`) are loaded as one group.
  - The **oldest** contact by `createdAt` becomes (or remains) the **primary**.
  - Other contacts in the group are converted to `"secondary"` with `linkedId` pointing to the primary if they were previously marked `"primary"`.
  - If the request contains a **new** email or phone number not already in the group, a new `"secondary"` contact is created and linked to the primary.

## Example requests

Assume the following existing contacts:

```text
[
  { "id": 1, "email": "lorraine@hillvalley.edu", "phoneNumber": "123456", "linkPrecedence": "primary" },
  { "id": 2, "email": "mcfly@hillvalley.edu",    "phoneNumber": "123456", "linkPrecedence": "secondary", "linkedId": 1 }
]
```

### Example 1 – Existing contact info

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "lorraine@hillvalley.edu", "phoneNumber": "123456"}'
```

Returns:

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

### Example 2 – No existing contacts

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com"}'
```

Returns (ids will vary):

```json
{
  "contact": {
    "primaryContactId": 3,
    "emails": ["newuser@example.com"],
    "phoneNumbers": [],
    "secondaryContactIds": []
  }
}
```


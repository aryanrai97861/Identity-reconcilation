# Bitespeed Identity Reconciliation Service

A backend web service that identifies and tracks customers across multiple purchases made with different contact information. Built for the Bitespeed backend task.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon.tech)
- **ORM**: Prisma

## Project Structure

```
├── prisma/
│   └── schema.prisma      # Database schema
├── src/
│   ├── db/
│   │   └── prisma.ts       # Prisma client singleton
│   ├── routes/
│   │   └── identify.ts     # POST /identify route
│   ├── services/
│   │   └── contact.service.ts  # Core reconciliation logic
│   └── index.ts            # Express server entry point
├── .env.example            # Environment variables template
├── package.json
└── tsconfig.json
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` and set your Neon.tech PostgreSQL connection string:
```
DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"
```

### 3. Set up database
```bash
npx prisma generate
npx prisma db push
```

### 4. Run the server
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API

### `POST /identify`

Identifies a customer by email and/or phone number and returns their consolidated contact information.

**Request Body:**
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```
> At least one of `email` or `phoneNumber` must be provided. Either can be `null`.

**Response (200 OK):**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

### Reconciliation Rules

| Scenario | Behavior |
|---|---|
| No existing contacts match | Creates a new **primary** contact |
| Matches found, request has new info | Creates a new **secondary** contact linked to the primary |
| Request links two separate primaries | Older primary stays; newer primary becomes **secondary** (merged) |

## Example Scenarios

### 1. New customer
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "lorraine@hillvalley.edu", "phoneNumber": "123456"}'
```

### 2. Returning customer with new email
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "mcfly@hillvalley.edu", "phoneNumber": "123456"}'
```

### 3. Lookup by phone only
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "123456"}'
```

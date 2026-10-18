# Database Schema

Source of truth: `api/prisma/schema.prisma`
Migrations: `api/prisma/migrations/`

## Current tables

### `User`
| Column      | Type     | Notes                                        |
|-------------|----------|----------------------------------------------|
| id          | String   | UUID, primary key                            |
| name        | String?  | display name shown in the UI                 |
| email       | String   | unique                                       |
| password    | String   | bcrypt hash (never plain text)               |
| cashBalance | Float    | virtual cash for paper trading (default 10000) |
| createdAt   | DateTime | auto                                         |
| updatedAt   | DateTime | auto                                         |

### `Conversation`
| Column     | Type     | Notes                              |
|------------|----------|------------------------------------|
| id         | String   | UUID, primary key                  |
| userId     | String   | FK → User.id, cascade on delete    |
| title      | String?  | first ~60 chars of opening prompt  |
| createdAt  | DateTime | auto                               |
| updatedAt  | DateTime | auto                               |

### `Message`
| Column         | Type     | Notes                              |
|----------------|----------|------------------------------------|
| id             | String   | UUID                               |
| conversationId | String   | FK → Conversation.id, cascade      |
| role           | String   | "user" \| "assistant" \| "system"  |
| content        | String   | the message body                   |
| blocked        | Boolean  | true if guardrails refused         |
| createdAt      | DateTime | auto                               |

### `TransferQuote`
| Column         | Type     | Notes                                                |
|----------------|----------|------------------------------------------------------|
| id             | String   | UUID                                                 |
| userId         | String   | FK → User.id, cascade                                |
| fromCurrency   | String   | e.g. "USD"                                           |
| toCurrency     | String   | e.g. "NGN"                                           |
| sendAmount     | Float    | source currency                                      |
| midMarketRate  | Float    | the "Google" rate                                    |
| ourRate        | Float    | what we offer (= midMarketRate * (1 - markupPct/100))|
| markupPct      | Float    | FX markup percentage                                 |
| feeAmount      | Float    | flat + variable fee                                  |
| totalCost      | Float    | sendAmount + feeAmount                               |
| receiveAmount  | Float    | recipient currency amount                            |
| speedTier      | String   | "economy" \| "standard" \| "express"                 |
| deliveryEtaMin | Int      | minutes                                              |
| deliveryEtaMax | Int      | minutes                                              |
| expiresAt      | DateTime | quote lock expiry (10 min)                           |
| createdAt      | DateTime | auto                                                 |

### `Transfer`
| Column        | Type     | Notes                                          |
|---------------|----------|------------------------------------------------|
| id            | String   | UUID                                           |
| userId        | String   | FK → User.id, cascade                          |
| quoteId       | String   | unique FK → TransferQuote.id                   |
| status        | String   | "pending" \| "sent" \| "delivered" \| "cancelled" |
| recipientName | String   | nickname or full name                          |
| createdAt     | DateTime | auto                                           |
| updatedAt     | DateTime | auto                                           |

## Migration history
- `20260430163539_init_users` — created `User` table
- `20260504011536_add_assistant_conversations` — added `Conversation`, `Message`
- `20260504013601_add_transfers` — added `TransferQuote`, `Transfer`
- `20260510233349_add_investing` — added `Asset`, `WatchlistItem`, `PaperOrder`, `Position`, and `User.cashBalance`
- `20260611041000_add_user_name` — added nullable `User.name`

## Investing tables

### `Asset`
| Column      | Type     | Notes                                         |
|-------------|----------|-----------------------------------------------|
| id          | String   | UUID                                          |
| symbol      | String   | unique, e.g. "AAPL", "BTC"                    |
| name        | String   | "Apple Inc."                                  |
| assetClass  | String   | "stock" \| "etf" \| "crypto"                  |
| sector      | String?  | e.g. "Technology"                             |
| basePrice   | Float    | anchor price for mock pricing                 |
| riskLevel   | String   | "low" \| "medium" \| "high"                   |
| description | String?  | short blurb for the detail page               |
| createdAt   | DateTime | auto                                          |

### `WatchlistItem`
| Column    | Type     | Notes                                                  |
|-----------|----------|--------------------------------------------------------|
| id        | String   | UUID                                                   |
| userId    | String   | FK → User.id, cascade                                  |
| assetId   | String   | FK → Asset.id, cascade                                 |
| createdAt | DateTime | auto                                                   |
|           |          | `@@unique([userId, assetId])`                          |

### `PaperOrder`
| Column    | Type     | Notes                                                  |
|-----------|----------|--------------------------------------------------------|
| id        | String   | UUID                                                   |
| userId    | String   | FK → User.id, cascade                                  |
| assetId   | String   | FK → Asset.id                                          |
| side      | String   | "buy" \| "sell"                                        |
| quantity  | Float    | shares (supports fractional)                           |
| price     | Float    | executed mock price                                    |
| total     | Float    | price × quantity                                       |
| status    | String   | "filled" (always, for the MVP)                         |
| createdAt | DateTime | auto                                                   |

### `Position`
| Column    | Type     | Notes                                                  |
|-----------|----------|--------------------------------------------------------|
| id        | String   | UUID                                                   |
| userId    | String   | FK → User.id, cascade                                  |
| assetId   | String   | FK → Asset.id                                          |
| quantity  | Float    | current holding                                        |
| avgCost   | Float    | weighted-average cost basis per share                  |
| updatedAt | DateTime | auto                                                   |
|           |          | `@@unique([userId, assetId])`                          |

## Planned tables (not built yet)
- `Profile` — fullName, country, riskLevel
- `AuditLog` — sensitive event tracking

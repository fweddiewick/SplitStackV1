# SplitStack SG - API & Model Context Protocol (MCP)

This directory houses the API specifications and Model Context Protocol (MCP) tool integrations for **SplitStack SG**.

## Directory Structure
- `types.ts`: TypeScript schemas conforming to the JSON-RPC 2.0 and Anthropic/OpenAI MCP tool interface.
- `tools.ts`: Definitions of all tools, including dynamic reward evaluation from user-added payment methods.
- `server.ts`: A lightweight MCP server engine capable of running in browser contexts or backend Node/Express servers.

## Available MCP Tools

### 1. `recommend_optimal_card`
- **Purpose**: Dynamically evaluates the user's added credit cards against a given merchant name and transaction amount in SGD.
- **Features**:
  - Dynamically pulls only from the user's current payment methods.
  - Verifies $5 block rounding slippage (UOB / OCBC rules).
  - Checks MCC categories and explicit exclusion terms (e.g. Utilities, Airlines).
  - Enforces monthly bonus caps; flags and avoids capped-out cards.
- **Arguments**:
  - `merchant`: `string` (e.g., `"FairPrice"`, `"Shopee"`, `"GrabFood"`)
  - `amount`: `number` (e.g., `312.40`)
  - `category`: `string` (optional override)

### 2. `calculate_expense_split`
- **Purpose**: Calculates cent-precision ledger splits across dynamic household members (e.g., 3-way, 4-way, or bilateral pairs) with deterministic penny-remainder allocation.

### 3. `get_card_limits`
- **Purpose**: Queries current spending versus bonus limits, remaining headroom, and overspend penalties for all active cards.

### 4. `manage_household_members`
- **Purpose**: Inspects and updates household members (Lead Payer, Member names, phone proxies, and roles).

## Usage Example (Client or MCP Host)

```typescript
import { SplitStackMCPServer } from './src/mcp/server';

const server = new SplitStackMCPServer(currentCards, currentMembers);

// 1. List available MCP tools
const toolList = server.handleRequest({
  method: 'tools/list',
});

// 2. Query card recommendation dynamically
const recommendation = server.handleRequest({
  method: 'tools/call',
  params: {
    name: 'recommend_optimal_card',
    arguments: {
      merchant: 'FairPrice Xtra',
      amount: 312.40,
    },
  },
});
```

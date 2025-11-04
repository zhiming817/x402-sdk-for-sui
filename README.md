# X402 SDK for Sui

X402 payment protocol SDK for Sui blockchain. This SDK enables HTTP 402 Payment Required responses with automatic on-chain payment handling on Sui.

## Features

- 🚀 **Easy Integration** - Simple Express middleware for payment-required routes
- 🔐 **Secure** - Cryptographic verification of payments on Sui blockchain
- 🌐 **Sui Native** - Full support for SUI and custom Coin types
- 🎯 **Flexible** - Support for both direct and facilitator-based settlement
- 📦 **TypeScript** - Full type safety and IntelliSense support

## Installation

```bash
npm install x402-sdk-for-sui
# or
pnpm add x402-sdk-for-sui
```

## Quick Start

### 1. Server Setup (Resource Provider)

```typescript
import express from "express";
import { paymentMiddleware } from "x402-sdk-for-sui/express";

const app = express();

// Configure payment middleware
app.use(
  paymentMiddleware(
    "0x...", // Your Sui address to receive payments
    {
      "/premium": {
        methods: ["GET"],
        price: "1000000000", // 1 SUI (9 decimals)
        description: "Premium content access"
      }
    },
    { url: "http://localhost:3002" }, // Facilitator URL
    undefined, // Paywall config (optional)
    {
      suiConfig: {
        network: "sui-localnet",
        rpcUrl: "http://127.0.0.1:9000"
      }
    }
  )
);

// Protected route
app.get("/premium", (req, res) => {
  res.json({ data: "Premium content" });
});

app.listen(4021);
```

### 2. Client Setup (Payment Sender)

```typescript
import {
  wrapFetchWithPayment,
  createSigner
} from "x402-sdk-for-sui/fetch";

// Create signer from private key
const signer = await createSigner("sui-localnet", privateKey);

// Wrap fetch with automatic payment
const fetchWithPayment = wrapFetchWithPayment(fetch, signer, undefined, undefined, {
  suiConfig: {
    network: "sui-localnet",
    rpcUrl: "http://127.0.0.1:9000"
  }
});

// Make request - payment happens automatically on 402 response
const response = await fetchWithPayment("http://localhost:4021/premium");
const data = await response.json();
```

### 3. Facilitator Setup (Optional)

```typescript
import { createFacilitatorServer } from "x402-sdk-for-sui";

// Start facilitator for payment verification and settlement
createFacilitatorServer(3002, "http://127.0.0.1:9000");
```

## Project Structure

```
x402-sdk-for-sui/
├── src/
│   ├── types/              # TypeScript type definitions
│   ├── x402/
│   │   ├── schemes/
│   │   │   └── exact/
│   │   │       └── sui/
│   │   │           ├── client.ts    # Client payment logic
│   │   │           └── server.ts    # Server verification logic
│   │   ├── middleware/              # Express middleware
│   │   └── facilitator/             # Facilitator service
│   ├── x402-fetch/                  # Fetch wrapper
│   └── index.ts                     # Main entry point
├── examples/                         # Example implementations
├── scripts/
│   └── setup-localnet.ts            # Localnet setup script
└── README.md
```

## Running Examples

### 1. Start Sui Localnet

```bash
sui start
```

### 2. Setup Local Environment

```bash
cd x402-sdk-for-sui
pnpm install
pnpm setup-localnet
```

This will:
- Generate keypairs for facilitator, server, and client
- Request SUI from local faucet
- Output environment variables for .env files

### 3. Configure Environment

Copy the output from `setup-localnet` to create three .env files:

**`.env`** (Facilitator):
```bash
SUI_PRIVATE_KEY=0x...
SUI_NETWORK=sui-localnet
SUI_RPC_URL=http://127.0.0.1:9000
PORT=3002
```

**`.env_server`** (Resource Server):
```bash
FACILITATOR_URL=http://localhost:3002
NETWORK=sui-localnet
ADDRESS=0x...
TOKEN_COIN_TYPE=0x2::sui::SUI
TOKEN_DECIMALS=9
TOKEN_NAME=SUI
SUI_RPC_URL=http://127.0.0.1:9000
PORT=4021
```

**`.env_client`** (Client):
```bash
SUI_NETWORK=sui-localnet
SUI_RPC_URL=http://127.0.0.1:9000
USER_SUI_PRIVATE_KEY=0x...
```

### 4. Run Services

In three separate terminals:

```bash
# Terminal 1: Start Facilitator
pnpm run 402_facilitator

# Terminal 2: Start Resource Server
pnpm run 402_server

# Terminal 3: Run Client
pnpm run 402_client
```

## API Reference

### Client Functions

#### `createSigner(network, privateKey)`
Create a signer from private key.

```typescript
const signer = await createSigner("sui-localnet", "0x...");
```

#### `wrapFetchWithPayment(fetch, signer, maxValue?, selector?, config?)`
Wrap fetch function with automatic payment handling.

```typescript
const fetchWithPayment = wrapFetchWithPayment(
  fetch,
  signer,
  1000000000n, // Max 1 SUI
  undefined,
  { suiConfig: { network: "sui-localnet" } }
);
```

### Server Functions

#### `paymentMiddleware(payTo, routes, facilitator?, paywall?, config?)`
Express middleware for payment-required routes.

```typescript
app.use(
  paymentMiddleware(
    "0x...",
    { "/premium": { price: "1000000000" } },
    { url: "http://localhost:3002" }
  )
);
```

#### `createFacilitatorServer(port, rpcUrl?)`
Create facilitator server for verification and settlement.

```typescript
createFacilitatorServer(3002, "http://127.0.0.1:9000");
```

## Custom Coin Support

To use custom Coin types instead of native SUI:

```typescript
{
  suiConfig: {
    network: "sui-localnet",
    rpcUrl: "http://127.0.0.1:9000"
  },
  tokenConfig: {
    coinType: "0x2::usdc::USDC", // Custom coin type
    decimals: 6,
    name: "USDC",
    symbol: "USDC"
  }
}
```

## Network Support

- `sui-localnet` - Local development
- `sui-devnet` - Sui Devnet
- `sui-testnet` - Sui Testnet
- `sui-mainnet` - Sui Mainnet

## Architecture

```
┌─────────┐           ┌────────────┐           ┌──────────────┐
│ Client  │──① 402───▶│   Server   │◀────②────▶│ Facilitator  │
└─────────┘           └────────────┘  verify   └──────────────┘
     │                       │                          │
     └───────③ Payment───────┘                          │
                             │                          │
                             └────④ Settlement─────────▶│
                                                        │
                                                   ┌────▼────┐
                                                   │   Sui   │
                                                   │Blockchain│
                                                   └─────────┘
```

1. Client requests resource → Server returns 402 with payment requirements
2. Server asks Facilitator to verify payment
3. Client creates and signs payment transaction
4. Facilitator settles payment on Sui blockchain

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [X402 Protocol Specification](https://github.com/x402/spec)
- [Sui Documentation](https://docs.sui.io/)
- [GitHub Repository](https://github.com/zhiming817/x402-sdk-for-sui)
- [X402 Solana SDK](https://github.com/xilibi2003/x402-sdk-for-solana) - Reference implementation

## Support

For issues and questions:
- GitHub Issues: https://github.com/zhiming817/x402-sdk-for-sui/issues
- Discord: [Join our community]()

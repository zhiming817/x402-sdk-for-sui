import { config } from "dotenv";
import express from "express";
import type { Request, Response } from "express";
import {
  paymentMiddleware,
  type SuiAddress,
  type RoutesConfig,
  type FacilitatorConfig,
  type SuiNetwork
} from "../../src/x402-express/index";

config({ path: 'examples/.env_server' });

const app = express();
const port = parseInt(process.env.PORT || "4021");

// Configuration from environment
const facilitatorUrl = process.env.FACILITATOR_URL || "http://localhost:3002";
const network = (process.env.NETWORK || "sui-localnet") as SuiNetwork;
const payToAddress = process.env.ADDRESS as SuiAddress;
const tokenCoinType = process.env.TOKEN_COIN_TYPE || "0x2::sui::SUI";
const tokenDecimals = parseInt(process.env.TOKEN_DECIMALS || "9");
const tokenName = process.env.TOKEN_NAME || "SUI";

console.log("=== Starting X402 Server (Sui) ===");
console.log(`Port: ${port}`);
console.log(`Network: ${network}`);
console.log(`Pay To: ${payToAddress}`);
console.log(`Token: ${tokenName} (${tokenCoinType})`);
console.log(`Facilitator: ${facilitatorUrl}`);

if (!payToAddress) {
  console.error("Error: ADDRESS environment variable is required");
  process.exit(1);
}

// Define routes that require payment
const routes: RoutesConfig = {
  "/weather": {
    methods: ["GET"],
    price: "1000000000", // 1 SUI (9 decimals)
    description: "Get weather information"
  },
  "/premium-data": {
    methods: ["GET", "POST"],
    price: "2000000000", // 2 SUI
    description: "Access premium data endpoint"
  }
};

const facilitatorConfig: FacilitatorConfig = {
  url: facilitatorUrl,
  timeout: 30000
};

// Apply payment middleware
app.use(
  paymentMiddleware(
    payToAddress,
    routes,
    facilitatorConfig,
    {
      title: "X402 Payment Required",
      description: "This resource requires payment to access"
    },
    {
      suiConfig: {
        network,
        rpcUrl: process.env.SUI_RPC_URL
      },
      tokenConfig: {
        coinType: tokenCoinType,
        decimals: tokenDecimals,
        name: tokenName
      }
    }
  )
);

// Protected route
app.get("/weather", (req: Request, res: Response) => {
  res.json({
    location: "San Francisco",
    temperature: 72,
    conditions: "Sunny",
    timestamp: new Date().toISOString()
  });
});

// Another protected route
app.get("/premium-data", (req: Request, res: Response) => {
  res.json({
    data: "Premium content",
    access_level: "premium",
    timestamp: new Date().toISOString()
  });
});

// Public route (no payment required)
app.get("/public", (req: Request, res: Response) => {
  res.json({
    message: "This is a public endpoint, no payment required"
  });
});

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`\nServer running on http://localhost:${port}`);
  console.log(`Try accessing:`);
  console.log(`  - http://localhost:${port}/public (free)`);
  console.log(`  - http://localhost:${port}/weather (requires payment)`);
  console.log(`  - http://localhost:${port}/premium-data (requires payment)`);
});

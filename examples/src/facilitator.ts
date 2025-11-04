import { config } from "dotenv";
import { createFacilitatorServer } from "x402-sdk-for-sui";

config({ path: '.env' });

const port = parseInt(process.env.PORT || "3002");
const rpcUrl = process.env.SUI_RPC_URL;

console.log("=== Starting X402 Facilitator Server (Sui) ===");
console.log(`Port: ${port}`);
console.log(`RPC URL: ${rpcUrl || "(using default)"}`);

createFacilitatorServer(port, rpcUrl);

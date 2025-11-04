import { config } from "dotenv";
import {
  decodeXPaymentResponse,
  wrapFetchWithPayment,
  createSigner
} from "../../src/x402-fetch/index";

config({ path: 'examples/.env_client' });

const suiPrivateKey = process.env.USER_SUI_PRIVATE_KEY || "";
const suiNetwork = (process.env.SUI_NETWORK || "sui-devnet") as any;
const rpcUrl = process.env.SUI_RPC_URL || "";
const needPayResourceUrl = "http://localhost:4021/weather";

console.log("=== X402 Client (Sui) ===");
console.log(`Network: ${suiNetwork}`);
console.log(`RPC URL: ${rpcUrl || "(using default)"}`);
console.log(`Resource URL: ${needPayResourceUrl}`);

if (!needPayResourceUrl || !suiPrivateKey) {
  console.error("Missing required environment variables");
  console.error("Required: USER_SUI_PRIVATE_KEY, NEED_PAY_RESOURCE_URL");
  process.exit(1);
}

/**
 * This example shows how to use the x402-fetch package to make a request
 * to a resource server that requires a payment.
 */
async function main(): Promise<void> {
  // Create signer from private key
  const suiSigner = await createSigner(suiNetwork, suiPrivateKey);
  console.log(`Signer address: ${suiSigner.address}`);

  // Wrap fetch with payment handling
  const fetchWithPayment = wrapFetchWithPayment(
    fetch,
    suiSigner,
    undefined, // maxValue - ensure payment doesn't exceed maximum
    undefined, // paymentRequirementsSelector - select payment option
    {
      suiConfig: {
        network: suiNetwork,
        rpcUrl: rpcUrl
      }
    }
  );

  try {
    console.log("\nMaking request to protected resource...");

    // The function will:
    // 1. Detect 402 status code
    // 2. Parse payment requirements from x-payment-required header
    // 3. Create and sign payment transaction
    // 4. Attach payment info (x-payment header) and resend request
    const response = await fetchWithPayment(needPayResourceUrl, {
      method: "GET"
    });

    console.log(`Response status: ${response.status}`);

    if (response.ok) {
      const body = await response.json();
      console.log("\nResponse body:");
      console.log(JSON.stringify(body, null, 2));

      // Decode payment response if available
      const paymentResponseHeader = response.headers.get("x-payment-response");
      if (paymentResponseHeader) {
        const paymentResponse = decodeXPaymentResponse(paymentResponseHeader);
        console.log("\nPayment response:");
        console.log(`  Transaction: ${paymentResponse.transactionDigest}`);
        console.log(`  Amount: ${paymentResponse.amount}`);
        console.log(`  Timestamp: ${new Date(paymentResponse.timestamp).toISOString()}`);
      }

      return;
    } else {
      console.error(`Request failed with status: ${response.status}`);
      const text = await response.text();
      console.error(text);
    }
  } catch (error) {
    console.error("\nRequest failed:");
    console.error(error instanceof Error ? error.message : error);
    throw error;
  }
}

main().catch(error => {
  console.error("\nFatal error:");
  console.error(error);
  process.exit(1);
});

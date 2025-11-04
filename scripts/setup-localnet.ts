import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";

const RPC_URL = "http://127.0.0.1:9000";

interface KeypairInfo {
  name: string;
  privateKey: string;
  address: string;
  keypair: Ed25519Keypair;
}

async function main() {
  console.log("=== Sui Localnet Automated Setup ===\n");

  const client = new SuiClient({ url: RPC_URL });

  // Check if localnet is running
  try {
    await client.getChainIdentifier();
  } catch (error) {
    console.error("Error: Cannot connect to Sui localnet at", RPC_URL);
    console.error("Please ensure Sui localnet is running:");
    console.error("  sui start");
    process.exit(1);
  }

  // 1. Generate keypairs
  console.log("1. Generating keypairs...\n");

  const facilitator: KeypairInfo = {
    name: "Facilitator (Fee Payer)",
    keypair: new Ed25519Keypair(),
    privateKey: "",
    address: ""
  };
  facilitator.privateKey = facilitator.keypair.getSecretKey();
  facilitator.address = facilitator.keypair.toSuiAddress();

  const server: KeypairInfo = {
    name: "Server (Payment Receiver)",
    keypair: new Ed25519Keypair(),
    privateKey: "",
    address: ""
  };
  server.privateKey = server.keypair.getSecretKey();
  server.address = server.keypair.toSuiAddress();

  const clientKeypair: KeypairInfo = {
    name: "Client (Payment Sender)",
    keypair: new Ed25519Keypair(),
    privateKey: "",
    address: ""
  };
  clientKeypair.privateKey = clientKeypair.keypair.getSecretKey();
  clientKeypair.address = clientKeypair.keypair.toSuiAddress();

  for (const kp of [facilitator, server, clientKeypair]) {
    console.log(`${kp.name}:`);
    console.log(`  Private Key: ${kp.privateKey}`);
    console.log(`  Address: ${kp.address}\n`);
  }

  // 2. Request SUI from faucet
  console.log("2. Requesting SUI from faucet...\n");

  for (const kp of [facilitator, server, clientKeypair]) {
    console.log(`${kp.name}:`);
    try {
      // Request from local faucet
      const response = await fetch("http://127.0.0.1:9123/gas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          FixedAmountRequest: {
            recipient: kp.address
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`  Requested 10 SUI from faucet`);
        console.log(`  Transaction: ${result.transferredGasObjects?.[0]?.id || "success"}\n`);
      } else {
        console.log(`  Warning: Faucet request failed (${response.status})`);
        console.log(`  You may need to fund this address manually\n`);
      }
    } catch (error) {
      console.log(`  Warning: Could not connect to faucet`);
      console.log(`  You may need to fund this address manually\n`);
    }

    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 3. Wait for transactions to be confirmed
  console.log("3. Waiting for transactions to be confirmed...\n");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 4. Check balances
  console.log("4. Checking balances...\n");

  for (const kp of [facilitator, server, clientKeypair]) {
    const balance = await client.getBalance({ owner: kp.address });
    const suiBalance = Number(balance.totalBalance) / 1_000_000_000;
    console.log(`${kp.name}: ${suiBalance} SUI`);
  }

  // 5. Output environment variables
  console.log("\n=== Setup Complete! ===\n");

  console.log("Environment Variables for .env:");
  console.log(`SUI_PRIVATE_KEY=${facilitator.privateKey}`);
  console.log(`SUI_NETWORK=sui-localnet`);
  console.log(`SUI_RPC_URL=${RPC_URL}`);
  console.log(`PORT=3002\n`);

  console.log("Environment Variables for .env_server:");
  console.log(`FACILITATOR_URL=http://localhost:3002`);
  console.log(`NETWORK=sui-localnet`);
  console.log(`ADDRESS=${server.address}`);
  console.log(`TOKEN_COIN_TYPE=0x2::sui::SUI`);
  console.log(`TOKEN_DECIMALS=9`);
  console.log(`TOKEN_NAME=SUI`);
  console.log(`SUI_RPC_URL=${RPC_URL}`);
  console.log(`PORT=4021\n`);

  console.log("Environment Variables for .env_client:");
  console.log(`SUI_NETWORK=sui-localnet`);
  console.log(`SUI_RPC_URL=${RPC_URL}`);
  console.log(`USER_SUI_PRIVATE_KEY=${clientKeypair.privateKey}\n`);

  console.log("Next steps:");
  console.log("1. Copy the environment variables above to your .env files");
  console.log("2. Start the facilitator: pnpm run 402_facilitator");
  console.log("3. Start the server: pnpm run 402_server");
  console.log("4. Run the client: pnpm run 402_client");
}

main().catch(error => {
  console.error("Setup failed:", error);
  process.exit(1);
});

import { Transaction } from "@mysten/sui/transactions";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromHex, toB64 } from "@mysten/bcs";
import type {
  SuiAddress,
  SuiNetwork,
  PaymentRequirement,
  PaymentPayload,
} from "../../../../types";

export interface SuiSigner {
  address: SuiAddress;
  keypair: Ed25519Keypair;
}

/**
 * Create a signer from a private key
 * @param network - Sui network (sui-localnet, sui-devnet, sui-testnet, sui-mainnet)
 * @param privateKey - Private key in hex format (with or without 0x prefix)
 * @returns SuiSigner object containing address and keypair
 */
export async function createSigner(
  network: SuiNetwork,
  privateKey: string
): Promise<SuiSigner> {
  try {
    // Remove 0x prefix if present
    const cleanKey = privateKey.replace(/^0x/, "");
    
    // Convert hex to bytes
    const privateKeyBytes = fromHex(cleanKey);
    
    // Create keypair from secret key
    const keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);

    return {
      address: keypair.toSuiAddress(),
      keypair
    };
  } catch (error) {
    throw new Error(`Invalid private key format: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Get Sui client for the specified network
 */
function getSuiClient(network: SuiNetwork, rpcUrl?: string): SuiClient {
  if (rpcUrl) {
    return new SuiClient({ url: rpcUrl });
  }
  
  const networkName = network.replace("sui-", "") as "localnet" | "devnet" | "testnet" | "mainnet";
  return new SuiClient({ url: getFullnodeUrl(networkName) });
}

/**
 * Create and sign a payment transaction
 * @param paymentRequirement - Payment requirements from the server
 * @param signer - Sui signer with keypair
 * @param rpcUrl - Optional custom RPC URL
 * @returns PaymentPayload with signed transaction
 */
export async function createAndSignPayment(
  paymentRequirement: PaymentRequirement,
  signer: SuiSigner,
  rpcUrl?: string
): Promise<PaymentPayload> {
  const client = getSuiClient(paymentRequirement.network, rpcUrl);

  try {
    // Create transaction
    const tx = new Transaction();
    
    const amount = BigInt(paymentRequirement.maxAmountRequired);
    
    if (paymentRequirement.asset === "0x2::sui::SUI") {
      // SUI native coin transfer
      const [coin] = tx.splitCoins(tx.gas, [amount]);
      tx.transferObjects([coin], paymentRequirement.payTo);
    } else {
      // Custom coin transfer
      // Get sender's coin objects
      const coins = await client.getCoins({
        owner: signer.address,
        coinType: paymentRequirement.asset
      });

      if (coins.data.length === 0) {
        throw new Error(`No coins found for type ${paymentRequirement.asset}`);
      }

      // Select enough coins
      let totalAmount = BigInt(0);
      const selectedCoins: string[] = [];
      
      for (const coin of coins.data) {
        selectedCoins.push(coin.coinObjectId);
        totalAmount += BigInt(coin.balance);
        if (totalAmount >= amount) break;
      }

      if (totalAmount < amount) {
        throw new Error(
          `Insufficient balance. Required: ${amount}, Available: ${totalAmount}`
        );
      }

      // Merge coins if multiple
      if (selectedCoins.length > 1) {
        tx.mergeCoins(selectedCoins[0], selectedCoins.slice(1));
      }
      
      // Split and transfer
      const [splitCoin] = tx.splitCoins(selectedCoins[0], [amount]);
      tx.transferObjects([splitCoin], paymentRequirement.payTo);
    }

    // Set sender
    tx.setSender(signer.address);

    // Build transaction bytes
    const txBytes = await tx.build({ client });
    
    // Sign transaction
    const { signature } = await signer.keypair.signTransaction(txBytes);

    return {
      scheme: "exact",
      network: paymentRequirement.network,
      transaction: toB64(txBytes),
      signature: toB64(signature),
      amount: paymentRequirement.maxAmountRequired,
      payTo: paymentRequirement.payTo,
      asset: paymentRequirement.asset
    };
  } catch (error) {
    console.error("Failed to create and sign payment:", error);
    throw error;
  }
}

/**
 * Create payment header from payment requirement
 * @param paymentRequirement - Payment requirements
 * @param signer - Sui signer
 * @param rpcUrl - Optional custom RPC URL
 * @returns Base64 encoded payment header
 */
export async function createPaymentHeader(
  paymentRequirement: PaymentRequirement,
  signer: SuiSigner,
  rpcUrl?: string
): Promise<string> {
  const payment = await createAndSignPayment(paymentRequirement, signer, rpcUrl);
  return Buffer.from(JSON.stringify(payment)).toString("base64");
}

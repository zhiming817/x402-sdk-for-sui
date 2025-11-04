import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { fromB64, toB64 } from "@mysten/bcs";
import type {
  PaymentRequirement,
  PaymentPayload,
  PaymentResponse,
  SuiNetwork
} from "../../../../types";

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
 * Verify payment transaction matches requirements
 * @param paymentPayload - Payment data from client
 * @param paymentRequirement - Expected payment requirements
 * @param rpcUrl - Optional custom RPC URL
 * @returns true if payment is valid
 */
export async function verifyPayment(
  paymentPayload: PaymentPayload,
  paymentRequirement: PaymentRequirement,
  rpcUrl?: string
): Promise<boolean> {
  try {
    // 1. Verify basic fields
    if (paymentPayload.scheme !== "exact") {
      console.error("Invalid payment scheme:", paymentPayload.scheme);
      return false;
    }

    if (paymentPayload.network !== paymentRequirement.network) {
      console.error("Network mismatch:", paymentPayload.network, "vs", paymentRequirement.network);
      return false;
    }

    if (paymentPayload.payTo !== paymentRequirement.payTo) {
      console.error("PayTo address mismatch:", paymentPayload.payTo, "vs", paymentRequirement.payTo);
      return false;
    }

    if (paymentPayload.asset !== paymentRequirement.asset) {
      console.error("Asset type mismatch:", paymentPayload.asset, "vs", paymentRequirement.asset);
      return false;
    }

    // 2. Verify amount
    const paidAmount = BigInt(paymentPayload.amount);
    const requiredAmount = BigInt(paymentRequirement.maxAmountRequired);
    
    if (paidAmount < requiredAmount) {
      console.error("Insufficient payment amount:", paidAmount.toString(), "vs", requiredAmount.toString());
      return false;
    }

    // 3. Verify transaction signature by dry run
    const client = getSuiClient(paymentPayload.network, rpcUrl);

    const txBytes = fromB64(paymentPayload.transaction);
    
    // Dry run to validate transaction
    const dryRunResult = await client.dryRunTransactionBlock({
      transactionBlock: txBytes
    });

    if (dryRunResult.effects.status.status !== "success") {
      console.error("Transaction dry run failed:", dryRunResult.effects.status.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Payment verification failed:", error);
    return false;
  }
}

/**
 * Settle (execute) the payment transaction on-chain
 * @param paymentPayload - Payment data with signed transaction
 * @param rpcUrl - Optional custom RPC URL
 * @returns PaymentResponse with transaction digest
 */
export async function settlePayment(
  paymentPayload: PaymentPayload,
  rpcUrl?: string
): Promise<PaymentResponse> {
  const client = getSuiClient(paymentPayload.network, rpcUrl);

  try {
    // Execute transaction - signature is already in base64 string format
    const result = await client.executeTransactionBlock({
      transactionBlock: fromB64(paymentPayload.transaction),
      signature: paymentPayload.signature,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true
      }
    });

    if (result.effects?.status?.status !== "success") {
      throw new Error(`Transaction failed: ${result.effects?.status?.error || "Unknown error"}`);
    }

    return {
      transactionDigest: result.digest,
      amount: paymentPayload.amount,
      timestamp: Date.now(),
      effects: result.effects
    };
  } catch (error) {
    console.error("Payment settlement failed:", error);
    throw error;
  }
}

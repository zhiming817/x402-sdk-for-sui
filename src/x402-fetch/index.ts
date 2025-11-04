import type {
  PaymentRequirement,
  X402Config,
  PaymentResponse
} from "../types";
import {
  createPaymentHeader,
  type SuiSigner
} from "../x402/schemes/exact/sui/client";

export { createSigner } from "../x402/schemes/exact/sui/client";

/**
 * Decode X-PAYMENT-REQUIRED header
 * @param header - Base64 encoded payment requirements
 * @returns Array of payment requirements
 */
export function decodeXPaymentRequired(header: string): PaymentRequirement[] {
  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    return parsed.accepts || [parsed];
  } catch (error) {
    console.error("Failed to decode x-payment-required header:", error);
    throw new Error("Invalid payment required header format");
  }
}

/**
 * Decode X-PAYMENT-RESPONSE header
 * @param header - Base64 encoded payment response
 * @returns Payment response object
 */
export function decodeXPaymentResponse(header: string): PaymentResponse {
  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch (error) {
    console.error("Failed to decode x-payment-response header:", error);
    throw new Error("Invalid payment response header format");
  }
}

/**
 * Wrap fetch function with automatic X402 payment handling
 * @param fetchFn - Original fetch function
 * @param signer - Sui signer with keypair
 * @param maxValue - Optional maximum payment amount allowed
 * @param paymentRequirementsSelector - Optional function to select from multiple payment options
 * @param config - Optional Sui network and token configuration
 * @returns Wrapped fetch function that handles 402 responses
 * 
 * @example
 * ```typescript
 * const signer = await createSigner("sui-localnet", privateKey);
 * const fetchWithPayment = wrapFetchWithPayment(fetch, signer);
 * 
 * const response = await fetchWithPayment("http://api.example.com/data");
 * const data = await response.json();
 * ```
 */
export function wrapFetchWithPayment(
  fetchFn: typeof fetch,
  signer: SuiSigner,
  maxValue?: bigint,
  paymentRequirementsSelector?: (reqs: PaymentRequirement[]) => PaymentRequirement,
  config?: X402Config
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // First request
    let response = await fetchFn(input, init);

    // Handle 402 Payment Required
    if (response.status === 402) {
      const paymentRequiredHeader = response.headers.get("x-payment-required");
      
      if (!paymentRequiredHeader) {
        throw new Error("402 status but no x-payment-required header found");
      }

      // Decode payment requirements
      const requirements = decodeXPaymentRequired(paymentRequiredHeader);
      
      if (requirements.length === 0) {
        throw new Error("No payment requirements provided");
      }

      // Select payment requirement
      const selectedRequirement = paymentRequirementsSelector
        ? paymentRequirementsSelector(requirements)
        : requirements[0];

      if (!selectedRequirement) {
        throw new Error("No suitable payment requirement found");
      }

      // Check maximum value limit
      if (maxValue !== undefined) {
        const requiredAmount = BigInt(selectedRequirement.maxAmountRequired);
        if (requiredAmount > maxValue) {
          throw new Error(
            `Payment amount (${requiredAmount}) exceeds maximum allowed value (${maxValue})`
          );
        }
      }

      console.log(`Creating payment: ${selectedRequirement.maxAmountRequired} ${selectedRequirement.asset}`);

      // Create payment header
      const paymentHeader = await createPaymentHeader(
        selectedRequirement,
        signer,
        config?.suiConfig?.rpcUrl
      );

      // Retry request with payment header
      const newHeaders = new Headers(init?.headers || {});
      newHeaders.set("x-payment", paymentHeader);

      response = await fetchFn(input, {
        ...init,
        headers: newHeaders
      });

      // Log payment response if available
      const paymentResponseHeader = response.headers.get("x-payment-response");
      if (paymentResponseHeader) {
        try {
          const paymentResponse = decodeXPaymentResponse(paymentResponseHeader);
          console.log(`Payment successful: ${paymentResponse.transactionDigest}`);
        } catch (error) {
          console.warn("Failed to decode payment response:", error);
        }
      }
    }

    return response;
  };
}

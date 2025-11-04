import type { Request, Response, NextFunction, RequestHandler } from "express";
import type {
  SuiAddress,
  RoutesConfig,
  FacilitatorConfig,
  PaywallConfig,
  X402Config,
  PaymentRequirement,
  PaymentPayload,
  TokenConfig
} from "../../types";
import { verifyPayment } from "../schemes/exact/sui/server";

const DEFAULT_TOKEN: TokenConfig = {
  coinType: "0x2::sui::SUI",
  decimals: 9,
  name: "SUI",
  symbol: "SUI"
};

/**
 * Express middleware for X402 payment protocol on Sui
 * @param payTo - Sui address to receive payments
 * @param routes - Configuration for routes requiring payment
 * @param facilitator - Optional facilitator configuration for verification/settlement
 * @param paywall - Optional paywall UI configuration
 * @param x402Config - Sui network and token configuration
 * @returns Express middleware function
 */
export function paymentMiddleware(
  payTo: SuiAddress,
  routes: RoutesConfig,
  facilitator?: FacilitatorConfig,
  paywall?: PaywallConfig,
  x402Config?: X402Config
): RequestHandler {
  const tokenConfig = x402Config?.tokenConfig || DEFAULT_TOKEN;
  const network = x402Config?.suiConfig?.network || "sui-localnet";
  const rpcUrl = x402Config?.suiConfig?.rpcUrl;

  return async (req: Request, res: Response, next: NextFunction) => {
    const routeConfig = routes[req.path];

    // If route doesn't require payment, continue
    if (!routeConfig) {
      return next();
    }

    // Check if method matches
    const methods = routeConfig.methods || ["GET"];
    if (!methods.includes(req.method)) {
      return next();
    }

    // Check for payment header
    const paymentHeader = req.headers["x-payment"] as string;

    if (!paymentHeader) {
      // Return 402 with payment requirements
      const paymentRequirement: PaymentRequirement = {
        scheme: "exact",
        network,
        maxAmountRequired: routeConfig.price,
        resource: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        description: routeConfig.description || "",
        mimeType: "",
        payTo,
        maxTimeoutSeconds: 60,
        asset: tokenConfig.coinType,
        outputSchema: {
          input: {
            type: "http",
            method: req.method,
            discoverable: true
          }
        },
        extra: facilitator ? {
          feePayer: "facilitator"
        } : undefined
      };

      const responseData = {
        x402Version: 1,
        error: "X-PAYMENT header is required",
        accepts: [paymentRequirement]
      };

      return res.status(402).json(responseData);
    }

    try {
      // Parse payment data
      const paymentPayload: PaymentPayload = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString("utf-8")
      );

      // Construct payment requirement for verification
      const paymentRequirement: PaymentRequirement = {
        scheme: "exact",
        network,
        maxAmountRequired: routeConfig.price,
        resource: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        payTo,
        maxTimeoutSeconds: 60,
        asset: tokenConfig.coinType
      };

      // Verify payment
      let isValid = false;
      
      if (facilitator) {
        // Verify through facilitator
        const verifyResponse = await fetch(`${facilitator.url}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentPayload, paymentRequirement }),
          signal: AbortSignal.timeout(facilitator.timeout || 30000)
        });

        isValid = verifyResponse.ok;
        
        if (!isValid) {
          const error = await verifyResponse.json().catch(() => ({}));
          console.error("Facilitator verification failed:", error);
        }
      } else {
        // Local verification
        isValid = await verifyPayment(paymentPayload, paymentRequirement, rpcUrl);
      }

      if (!isValid) {
        return res.status(402).json({
          x402Version: 1,
          error: "Payment verification failed"
        });
      }

      // Store payment info in request for later use
      (req as any).x402Payment = paymentPayload;

      // Execute original route handler
      const originalSend = res.send;
      const originalJson = res.json;
      let routeExecuted = false;
      let routeStatusCode = 200;

      res.send = function (data: any): Response {
        routeExecuted = true;
        routeStatusCode = res.statusCode;
        return originalSend.call(this, data);
      };

      res.json = function (data: any): Response {
        routeExecuted = true;
        routeStatusCode = res.statusCode;
        return originalJson.call(this, data);
      };

      // Continue to next middleware
      next();

      // Settle payment after response is sent
      res.on("finish", async () => {
        if (routeExecuted && routeStatusCode < 400) {
          try {
            if (facilitator) {
              // Settle through facilitator
              const settleResponse = await fetch(`${facilitator.url}/settle`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentPayload }),
                signal: AbortSignal.timeout(facilitator.timeout || 30000)
              });

              if (settleResponse.ok) {
                const paymentResponse = await settleResponse.json();
                res.setHeader(
                  "x-payment-response",
                  Buffer.from(JSON.stringify(paymentResponse)).toString("base64")
                );
                console.log("Payment settled:", paymentResponse.transactionDigest);
              } else {
                console.error("Settlement failed:", await settleResponse.text());
              }
            }
            // Note: If no facilitator, settlement happens in facilitator service
          } catch (error) {
            console.error("Payment settlement error:", error);
          }
        }
      });
    } catch (error) {
      console.error("Payment processing error:", error);
      return res.status(402).json({
        x402Version: 1,
        error: "Invalid payment format"
      });
    }
  };
}

import express from "express";
import type { Request, Response } from "express";
import { verifyPayment, settlePayment } from "../schemes/exact/sui/server";
import type { PaymentPayload, PaymentRequirement } from "../../types";

/**
 * Create a facilitator server for payment verification and settlement
 * @param port - Port to run the server on
 * @param rpcUrl - Optional Sui RPC URL
 * @returns Express application
 */
export function createFacilitatorServer(port: number = 3002, rpcUrl?: string) {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok", service: "x402-facilitator-sui" });
  });

  // Verify payment endpoint
  app.post("/verify", async (req: Request, res: Response) => {
    try {
      const { paymentPayload, paymentRequirement } = req.body as {
        paymentPayload: PaymentPayload;
        paymentRequirement: PaymentRequirement;
      };

      if (!paymentPayload || !paymentRequirement) {
        return res.status(400).json({
          valid: false,
          error: "Missing paymentPayload or paymentRequirement"
        });
      }

      const isValid = await verifyPayment(
        paymentPayload,
        paymentRequirement,
        rpcUrl
      );

      if (isValid) {
        res.json({ valid: true });
      } else {
        res.status(400).json({
          valid: false,
          error: "Payment verification failed"
        });
      }
    } catch (error) {
      console.error("Verify error:", error);
      res.status(500).json({
        valid: false,
        error: error instanceof Error ? error.message : "Internal server error"
      });
    }
  });

  // Settle payment endpoint
  app.post("/settle", async (req: Request, res: Response) => {
    try {
      const { paymentPayload } = req.body as { paymentPayload: PaymentPayload };

      if (!paymentPayload) {
        return res.status(400).json({
          error: "Missing paymentPayload"
        });
      }

      const paymentResponse = await settlePayment(paymentPayload, rpcUrl);
      
      res.json(paymentResponse);
    } catch (error) {
      console.error("Settle error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Settlement failed"
      });
    }
  });

  app.listen(port, () => {
    console.log(`Facilitator server running on port ${port}`);
    console.log(`- Health: http://localhost:${port}/health`);
    console.log(`- Verify: http://localhost:${port}/verify`);
    console.log(`- Settle: http://localhost:${port}/settle`);
  });

  return app;
}

export type SuiAddress = string;
export type SuiNetwork = "sui-localnet" | "sui-devnet" | "sui-testnet" | "sui-mainnet";

export interface SuiConfig {
  network: SuiNetwork;
  rpcUrl?: string;
  fullnodeUrl?: string;
}

export interface TokenConfig {
  coinType: string; // e.g., "0x2::sui::SUI" or custom coin type
  decimals: number;
  name: string;
  symbol?: string;
}

export interface X402Config {
  suiConfig: SuiConfig;
  tokenConfig?: TokenConfig;
}

export interface PaymentRequirement {
  scheme: "exact";
  network: SuiNetwork;
  maxAmountRequired: string;
  resource: string;
  description?: string;
  mimeType?: string;
  payTo: SuiAddress;
  maxTimeoutSeconds: number;
  asset: string; // Coin type
  outputSchema?: {
    input?: {
      type: string;
      method: string;
      discoverable?: boolean;
    };
  };
  extra?: {
    feePayer?: SuiAddress | "facilitator";
    [key: string]: any;
  };
}

export interface PaymentPayload {
  scheme: "exact";
  network: SuiNetwork;
  transaction: string; // Base64 encoded transaction bytes
  signature: string; // Base64 encoded signature
  amount: string;
  payTo: SuiAddress;
  asset: string;
}

export interface PaymentResponse {
  transactionDigest: string;
  amount: string;
  timestamp: number;
  effects?: any;
}

export interface Resource {
  path: string;
  method?: string;
  price: string;
  description?: string;
}

export interface RoutesConfig {
  [path: string]: {
    methods?: string[];
    price: string;
    description?: string;
  };
}

export interface FacilitatorConfig {
  url: string;
  timeout?: number;
}

export interface PaywallConfig {
  title?: string;
  description?: string;
  logoUrl?: string;
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
  };
}

export interface X402Response {
  x402Version: number;
  error?: string;
  accepts?: PaymentRequirement[];
}

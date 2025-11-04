# X402 SDK for Sui

基于 Sui 区块链的 X402 支付协议 SDK。该 SDK 实现了 HTTP 402 Payment Required 响应，并在 Sui 上自动处理链上支付。

## 特性

- 🚀 **易于集成** - 简单的 Express 中间件用于需要支付的路由
- 🔐 **安全可靠** - 基于 Sui 区块链的密码学验证
- 🌐 **原生支持** - 完整支持 SUI 和自定义 Coin 类型
- 🎯 **灵活配置** - 支持直接结算和 Facilitator 模式
- 📦 **TypeScript** - 完整的类型安全和智能提示

## 安装

```bash
npm install x402-sdk-for-sui
# 或
pnpm add x402-sdk-for-sui
```

## 快速开始

### 1. 服务端设置（资源提供方）

```typescript
import express from "express";
import { paymentMiddleware } from "x402-sdk-for-sui/express";

const app = express();

// 配置支付中间件
app.use(
  paymentMiddleware(
    "0x...", // 接收支付的 Sui 地址
    {
      "/premium": {
        methods: ["GET"],
        price: "1000000000", // 1 SUI (9 位小数)
        description: "高级内容访问"
      }
    },
    { url: "http://localhost:3002" }, // Facilitator URL
    undefined, // Paywall 配置（可选）
    {
      suiConfig: {
        network: "sui-localnet",
        rpcUrl: "http://127.0.0.1:9000"
      }
    }
  )
);

// 受保护的路由
app.get("/premium", (req, res) => {
  res.json({ data: "高级内容" });
});

app.listen(4021);
```

### 2. 客户端设置（支付方）

```typescript
import {
  wrapFetchWithPayment,
  createSigner
} from "x402-sdk-for-sui/fetch";

// 从私钥创建签名器
const signer = await createSigner("sui-localnet", privateKey);

// 包装 fetch 函数实现自动支付
const fetchWithPayment = wrapFetchWithPayment(fetch, signer, undefined, undefined, {
  suiConfig: {
    network: "sui-localnet",
    rpcUrl: "http://127.0.0.1:9000"
  }
});

// 发起请求 - 收到 402 响应时自动完成支付
const response = await fetchWithPayment("http://localhost:4021/premium");
const data = await response.json();
```

### 3. Facilitator 设置（可选）

```typescript
import { createFacilitatorServer } from "x402-sdk-for-sui";

// 启动 Facilitator 服务用于支付验证和结算
createFacilitatorServer(3002, "http://127.0.0.1:9000");
```

## 项目结构

```
x402-sdk-for-sui/
├── src/
│   ├── types/              # TypeScript 类型定义
│   ├── x402/
│   │   ├── schemes/
│   │   │   └── exact/
│   │   │       └── sui/
│   │   │           ├── client.ts    # 客户端支付逻辑
│   │   │           └── server.ts    # 服务端验证逻辑
│   │   ├── middleware/              # Express 中间件
│   │   └── facilitator/             # Facilitator 服务
│   ├── x402-fetch/                  # Fetch 包装器
│   └── index.ts                     # 主入口
├── examples/                         # 示例实现
├── scripts/
│   └── setup-localnet.ts            # 本地网络设置脚本
└── README.md
```

## 运行示例

### 1. 启动 Sui 本地网络

```bash
sui start
```

### 2. 设置本地环境

```bash
cd x402-sdk-for-sui
pnpm install
pnpm setup-localnet
```

该脚本会：
- 为 facilitator、server 和 client 生成密钥对
- 从本地水龙头请求 SUI
- 输出用于 .env 文件的环境变量

### 3. 配置环境变量

将 `setup-localnet` 的输出复制到三个 .env 文件：

**`.env`** (Facilitator):
```bash
SUI_PRIVATE_KEY=0x...
SUI_NETWORK=sui-localnet
SUI_RPC_URL=http://127.0.0.1:9000
PORT=3002
```

**`.env_server`** (资源服务器):
```bash
FACILITATOR_URL=http://localhost:3002
NETWORK=sui-localnet
ADDRESS=0x...
TOKEN_COIN_TYPE=0x2::sui::SUI
TOKEN_DECIMALS=9
TOKEN_NAME=SUI
SUI_RPC_URL=http://127.0.0.1:9000
PORT=4021
```

**`.env_client`** (客户端):
```bash
SUI_NETWORK=sui-localnet
SUI_RPC_URL=http://127.0.0.1:9000
USER_SUI_PRIVATE_KEY=0x...
```

### 4. 运行服务

在三个独立的终端中：

```bash
# 终端 1：启动 Facilitator
pnpm run 402_facilitator

# 终端 2：启动资源服务器
pnpm run 402_server

# 终端 3：运行客户端
pnpm run 402_client
```

## API 参考

### 客户端函数

#### `createSigner(network, privateKey)`
从私钥创建签名器。

```typescript
const signer = await createSigner("sui-localnet", "0x...");
```

#### `wrapFetchWithPayment(fetch, signer, maxValue?, selector?, config?)`
包装 fetch 函数实现自动支付。

```typescript
const fetchWithPayment = wrapFetchWithPayment(
  fetch,
  signer,
  1000000000n, // 最大 1 SUI
  undefined,
  { suiConfig: { network: "sui-localnet" } }
);
```

### 服务端函数

#### `paymentMiddleware(payTo, routes, facilitator?, paywall?, config?)`
用于需要支付路由的 Express 中间件。

```typescript
app.use(
  paymentMiddleware(
    "0x...",
    { "/premium": { price: "1000000000" } },
    { url: "http://localhost:3002" }
  )
);
```

#### `createFacilitatorServer(port, rpcUrl?)`
创建 Facilitator 服务器用于验证和结算。

```typescript
createFacilitatorServer(3002, "http://127.0.0.1:9000");
```

## 自定义 Coin 支持

使用自定义 Coin 类型而非原生 SUI：

```typescript
{
  suiConfig: {
    network: "sui-localnet",
    rpcUrl: "http://127.0.0.1:9000"
  },
  tokenConfig: {
    coinType: "0x2::usdc::USDC", // 自定义 coin 类型
    decimals: 6,
    name: "USDC",
    symbol: "USDC"
  }
}
```

## 网络支持

- `sui-localnet` - 本地开发网络
- `sui-devnet` - Sui 开发网
- `sui-testnet` - Sui 测试网
- `sui-mainnet` - Sui 主网

## 架构

```
┌─────────┐           ┌────────────┐           ┌──────────────┐
│  客户端  │──① 402───▶│   服务器    │◀────②────▶│ Facilitator  │
└─────────┘           └────────────┘  验证     └──────────────┘
     │                       │                          │
     └───────③ 支付 ─────────┘                          │
                             │                          │
                             └────④ 结算 ──────────────▶│
                                                        │
                                                   ┌────▼────┐
                                                   │   Sui   │
                                                   │ 区块链   │
                                                   └─────────┘
```

1. 客户端请求资源 → 服务器返回 402 和支付要求
2. 服务器请求 Facilitator 验证支付
3. 客户端创建并签名支付交易
4. Facilitator 在 Sui 区块链上结算支付

## 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

## 许可证

MIT License - 详见 [LICENSE](LICENSE)

## 链接

- [X402 协议规范](https://github.com/x402/spec)
- [Sui 文档](https://docs.sui.io/)
- [GitHub 仓库](https://github.com/xilibi2003/x402-sdk-for-sui)

## 支持

问题和疑问：
- GitHub Issues: https://github.com/xilibi2003/x402-sdk-for-sui/issues
- Discord: [加入社区]()

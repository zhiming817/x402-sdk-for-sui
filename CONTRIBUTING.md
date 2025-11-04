# Contributing to X402 SDK for Sui

We welcome contributions! Please follow these guidelines.

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Start Sui localnet: `sui start`
4. Run setup: `pnpm setup-localnet`
5. Make your changes
6. Test your changes with examples
7. Submit a pull request

## Code Style

- Follow existing code formatting
- Use TypeScript for all new code
- Add JSDoc comments for public APIs
- Run `pnpm build` before committing

## Testing

- Test with Sui localnet
- Verify all three components work together (client, server, facilitator)
- Test with both SUI and custom coins

## Pull Request Process

1. Update README.md if needed
2. Ensure code builds without errors
3. Test all examples work correctly
4. Update CHANGELOG.md
5. Submit PR with clear description

Thank you for contributing!

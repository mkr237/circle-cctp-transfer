# Circle Cross-Chain USDC Transfer Tool

A Node.js application for transferring USDC between different blockchains using Circle's Cross-Chain Transfer Protocol (CCTP).

## Features

- ✅ **Cross-chain USDC transfers** between supported networks
- ✅ **Interactive CLI** with wallet selection and transfer confirmation
- ✅ **Real-time monitoring** of transaction status
- ✅ **Recovery mode** to continue from partial transfers
- ✅ **Comprehensive error handling** and troubleshooting tips
- ✅ **Support for testnet and mainnet** networks

## Supported Networks

### Mainnet
- Ethereum (ETH)
- Polygon (MATIC)
- Avalanche (AVAX)

### Testnet
- Ethereum Sepolia (ETH-SEPOLIA)
- Polygon Amoy (MATIC-AMOY)

## Prerequisites

1. **Node.js** (v16 or higher)
2. **Circle Developer Account** with API key
3. **Entity Secret** registered with Circle
4. **Developer-controlled wallets** on supported networks
5. **USDC balance** in source wallet
6. **Native tokens** for gas fees on both networks

## Installation

1. Clone the repository:
```bash
git clone https://github.com/mkr237/circle-cctp-transfer.git
cd circle-cctp-transfer
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure your credentials in `.env`:
```env
CIRCLE_API_KEY=your_circle_api_key_here
CIRCLE_ENTITY_SECRET=your_entity_secret_here
```

## Usage

### Start the Application
```bash
node cross-chain-transfer.js
```

### Menu Options

**Option 1: Perform cross-chain transfer**
- Complete end-to-end USDC transfer between networks
- Includes approval, burn, attestation, and mint steps

**Option 2: Recover from burn**
- Continue from attestation step when burn already succeeded
- Useful for resuming interrupted transfers

### Transfer Process

1. **Approval** - Approve USDC spending by TokenMessenger contract
2. **Burn** - Burn USDC on source chain
3. **Attestation** - Wait for Circle's validation (10-20 minutes)
4. **Mint** - Mint USDC on destination chain

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CIRCLE_API_KEY` | Your Circle API key | Yes |
| `CIRCLE_ENTITY_SECRET` | Your registered entity secret | Yes |

### Network Configuration

The tool automatically detects and uses the correct:
- USDC contract addresses
- CCTP domain IDs
- TokenMessenger addresses
- MessageTransmitter addresses

## Troubleshooting

### Common Issues

**"No TokenMessenger for domain"**
- Ensure CCTP domain IDs are correct
- Verify network is supported by Circle's CCTP

**"ESTIMATION_ERROR"**
- Check contract addresses are correct
- Ensure sufficient gas fees
- Verify message hasn't been used already

**"Failed to create transaction"**
- Verify API key permissions
- Check wallet has sufficient USDC balance
- Ensure native tokens for gas fees

### Recovery Mode

If a transfer fails after the burn step:
1. Note the burn transaction hash
2. Run the tool and select "Recover from burn"
3. Enter the burn transaction hash
4. Complete attestation and mint steps

## API Reference

### Circle CCTP API
- **Testnet**: `https://iris-api-sandbox.circle.com`
- **Mainnet**: `https://iris-api.circle.com`

### Key Endpoints
- `GET /v1/messages/{sourceDomainId}/{transactionHash}` - Get attestation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- [Circle Developer Documentation](https://developers.circle.com)
- [CCTP Documentation](https://developers.circle.com/stablecoins/cctp-getting-started)
- [Circle Support](https://support.usdc.circle.com)

## Disclaimer

This tool is for educational and development purposes. Always test thoroughly on testnets before using with real funds on mainnet.

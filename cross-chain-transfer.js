require('dotenv').config();
const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
const config = require('./config');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Supported networks for USDC transfers
const SUPPORTED_NETWORKS = {
    'ETH': { name: 'Ethereum Mainnet', code: 'ETH', usdcContract: '0xA0b86a33E6441d7c4c5e2F4e7A1b7C4e5d6f7e8f' },
    'MATIC': { name: 'Polygon Mainnet', code: 'MATIC', usdcContract: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' },
    'AVAX': { name: 'Avalanche C-Chain', code: 'AVAX', usdcContract: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E' },
    'ETH-SEPOLIA': { name: 'Ethereum Sepolia (Testnet)', code: 'ETH-SEPOLIA', usdcContract: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' },
    'MATIC-AMOY': { name: 'Polygon Amoy (Testnet)', code: 'MATIC-AMOY', usdcContract: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582' }
};

let client;

// Helper function to prompt user input
function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

// Helper function to pause and wait for user
function waitForUser() {
    return askQuestion('\nPress Enter to continue...');
}

// Initialize Circle client
async function initializeClient() {
    try {
        client = initiateDeveloperControlledWalletsClient({
            apiKey: config.apiKey,
            entitySecret: config.entitySecret
        });
        console.log("✅ Circle SDK initialized successfully\n");
        return true;
    } catch (error) {
        console.error("❌ Failed to initialize Circle SDK:", error.message);
        return false;
    }
}

// Get all wallets from all wallet sets
async function getAllWallets() {
    try {
        console.log("🔍 Fetching all your wallets...");
        
        const walletSetsResponse = await client.listWalletSets();
        const walletSets = walletSetsResponse.data?.walletSets || [];
        
        if (walletSets.length === 0) {
            return [];
        }

        const allWallets = [];
        
        for (const walletSet of walletSets) {
            try {
                const walletsResponse = await client.listWallets({
                    walletSetId: walletSet.id
                });
                
                const wallets = walletsResponse.data?.wallets || [];
                
                // Add wallet set info to each wallet
                wallets.forEach(wallet => {
                    wallet.walletSetName = walletSet.name;
                    wallet.walletSetId = walletSet.id;
                });
                
                allWallets.push(...wallets);
            } catch (error) {
                console.log(`⚠️  Warning: Could not fetch wallets from set ${walletSet.name}: ${error.message}`);
            }
        }

        return allWallets;
    } catch (error) {
        console.error("❌ Error fetching wallets:", error.message);
        return [];
    }
}

// Get wallet balance
async function getWalletBalance(walletId) {
    try {
        console.log(`🔍 Checking balance for wallet ${walletId}...`);
        
        const balanceResponse = await client.getWalletTokenBalance({
            id: walletId
        });
        
        return balanceResponse.data?.tokenBalances || [];
    } catch (error) {
        console.log(`⚠️  Warning: Could not fetch balance: ${error.message}`);
        return [];
    }
}

// Find USDC balance in token balances
function findUSDCBalance(tokenBalances) {
    const usdcBalance = tokenBalances.find(balance => 
        balance.token?.symbol === 'USDC' || 
        balance.token?.name?.includes('USD Coin')
    );
    
    return usdcBalance ? parseFloat(usdcBalance.amount) : 0;
}

// Display wallet selection menu
function displayWalletMenu(wallets, title) {
    console.log(`\n${title}:`);
    console.log("─".repeat(80));
    
    wallets.forEach((wallet, index) => {
        const networkInfo = SUPPORTED_NETWORKS[wallet.blockchain];
        const networkName = networkInfo ? networkInfo.name : wallet.blockchain;
        
        console.log(`${index + 1}. ${wallet.address}`);
        console.log(`   Network: ${networkName} (${wallet.blockchain})`);
        console.log(`   Wallet Set: ${wallet.walletSetName}`);
        console.log(`   State: ${wallet.state}`);
        console.log('');
    });
}

// Perform cross-chain USDC transfer
async function performCrossChainTransfer() {
    try {
        console.log("\n💸 Cross-Chain USDC Transfer\n");
        console.log("This feature allows you to transfer USDC between different blockchains.");
        console.log("Circle's Cross-Chain Transfer Protocol (CCTP) handles the bridging.\n");

        // Get all wallets
        const allWallets = await getAllWallets();
        
        if (allWallets.length === 0) {
            console.log("❌ No wallets found. Please create some wallets first.");
            return;
        }

        // Filter wallets that are on supported networks
        const supportedWallets = allWallets.filter(wallet => 
            SUPPORTED_NETWORKS[wallet.blockchain] && wallet.state === 'LIVE'
        );

        if (supportedWallets.length < 2) {
            console.log("❌ You need at least 2 wallets on supported networks for cross-chain transfers.");
            console.log("Supported networks:", Object.values(SUPPORTED_NETWORKS).map(n => n.name).join(', '));
            return;
        }

        console.log(`✅ Found ${supportedWallets.length} wallets on supported networks\n`);

        // Select source wallet
        displayWalletMenu(supportedWallets, "📤 Select SOURCE wallet (where USDC will be sent FROM)");
        
        const sourceChoice = await askQuestion(`Select source wallet (1-${supportedWallets.length}): `);
        const sourceIndex = parseInt(sourceChoice) - 1;

        if (sourceIndex < 0 || sourceIndex >= supportedWallets.length) {
            console.log("❌ Invalid source wallet selection.");
            return;
        }

        const sourceWallet = supportedWallets[sourceIndex];
        console.log(`\n✅ Selected source: ${sourceWallet.address} on ${SUPPORTED_NETWORKS[sourceWallet.blockchain].name}`);

        // Check source wallet balance
        console.log("\n💰 Checking source wallet USDC balance...");
        const sourceBalances = await getWalletBalance(sourceWallet.id);
        const sourceUSDCBalance = findUSDCBalance(sourceBalances);

        console.log(`💰 Source wallet USDC balance: ${sourceUSDCBalance} USDC`);

        if (sourceUSDCBalance <= 0) {
            console.log("❌ Source wallet has no USDC balance. Please add USDC to this wallet first.");
            console.log("💡 Tip: You can get testnet USDC from faucets or transfer from exchanges for mainnet.");
            return;
        }

        // Select destination wallet (must be on different network)
        const destinationWallets = supportedWallets.filter(wallet => 
            wallet.blockchain !== sourceWallet.blockchain
        );

        if (destinationWallets.length === 0) {
            console.log("❌ No wallets found on different networks for cross-chain transfer.");
            console.log("💡 Create a wallet on a different blockchain to enable cross-chain transfers.");
            return;
        }

        displayWalletMenu(destinationWallets, "📥 Select DESTINATION wallet (where USDC will be sent TO)");
        
        const destChoice = await askQuestion(`Select destination wallet (1-${destinationWallets.length}): `);
        const destIndex = parseInt(destChoice) - 1;

        if (destIndex < 0 || destIndex >= destinationWallets.length) {
            console.log("❌ Invalid destination wallet selection.");
            return;
        }

        const destinationWallet = destinationWallets[destIndex];
        console.log(`\n✅ Selected destination: ${destinationWallet.address} on ${SUPPORTED_NETWORKS[destinationWallet.blockchain].name}`);

        // Get transfer amount
        const amountInput = await askQuestion(`\nEnter USDC amount to transfer (max: ${sourceUSDCBalance}): `);
        const transferAmount = parseFloat(amountInput);

        if (isNaN(transferAmount) || transferAmount <= 0) {
            console.log("❌ Invalid amount. Please enter a positive number.");
            return;
        }

        if (transferAmount > sourceUSDCBalance) {
            console.log(`❌ Insufficient balance. You have ${sourceUSDCBalance} USDC, but tried to transfer ${transferAmount} USDC.`);
            return;
        }

        // Confirm transfer details
        console.log("\n" + "=".repeat(60));
        console.log("🔄 TRANSFER CONFIRMATION");
        console.log("=".repeat(60));
        console.log(`📤 FROM: ${sourceWallet.address}`);
        console.log(`   Network: ${SUPPORTED_NETWORKS[sourceWallet.blockchain].name}`);
        console.log(`📥 TO: ${destinationWallet.address}`);
        console.log(`   Network: ${SUPPORTED_NETWORKS[destinationWallet.blockchain].name}`);
        console.log(`💰 Amount: ${transferAmount} USDC`);
        console.log(`💳 Source Balance: ${sourceUSDCBalance} USDC`);
        console.log("=".repeat(60));

        const confirmation = await askQuestion("\nConfirm this cross-chain transfer? (yes/no): ");
        
        if (confirmation.toLowerCase() !== 'yes' && confirmation.toLowerCase() !== 'y') {
            console.log("❌ Transfer cancelled.");
            return;
        }

        // Initiate the transfer
        console.log("\n🚀 Initiating cross-chain USDC transfer...");
        console.log("⏳ This will involve multiple steps: Approval → Burn → Attestation → Mint");
        console.log("📋 Each step will be clearly logged with progress updates\n");

        try {
            // Step 1: Approve USDC spending by TokenMessenger contract
            console.log("🔐 Step 1/4: Approving USDC spending...");
            console.log(`💰 Approving ${transferAmount} USDC for TokenMessenger contract`);
            
            const approvalResponse = await client.createContractExecutionTransaction({
                walletId: sourceWallet.id,
                contractAddress: SUPPORTED_NETWORKS[sourceWallet.blockchain].usdcContract,
                abiFunctionSignature: "approve(address,uint256)",
                abiParameters: [
                    "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5", // TokenMessenger contract address
                    (transferAmount * 1000000).toString() // USDC has 6 decimals
                ],
                fee: {
                    type: "level",
                    config: {
                        feeLevel: "MEDIUM"
                    }
                }
            });
            
            const approvalTx = approvalResponse.data?.id;
            if (!approvalTx) {
                throw new Error("Failed to create approval transaction");
            }

            console.log(`✅ Approval transaction created: ${approvalTx}`);
            console.log("⏳ Waiting for approval transaction to be confirmed...");
            
            // Wait for approval transaction to complete
            const approvalTxHash = await waitForTransactionCompletion(approvalTx, "Approval");
            console.log(`✅ Approval confirmed! TX Hash: ${approvalTxHash}`);

            // Step 2: Burn USDC on source chain
            console.log("\n🔥 Step 2/4: Burning USDC on source chain...");
            console.log(`� Source: ${SUPPORTED_NETWORKS[sourceWallet.blockchain].name}`);
            
            // Get destination domain ID for CCTP
            const destinationDomain = getCCTPDomainId(destinationWallet.blockchain);
            
            // Encode destination address to bytes32
            const encodedDestinationAddress = addressToBytes32(destinationWallet.address);
            
            const burnResponse = await client.createContractExecutionTransaction({
                walletId: sourceWallet.id,
                contractAddress: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5", // TokenMessenger contract
                abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address)",
                abiParameters: [
                    (transferAmount * 1000000).toString(), // Amount in USDC units (6 decimals)
                    destinationDomain.toString(), // Destination domain
                    encodedDestinationAddress, // Recipient address as bytes32
                    SUPPORTED_NETWORKS[sourceWallet.blockchain].usdcContract // Source USDC contract
                ],
                fee: {
                    type: "level",
                    config: {
                        feeLevel: "MEDIUM"
                    }
                }
            });

            const burnTx = burnResponse.data?.id;
            if (!burnTx) {
                throw new Error("Failed to create burn transaction");
            }

            console.log(`✅ Burn transaction created: ${burnTx}`);
            console.log("⏳ Waiting for burn transaction to be confirmed...");
            
            // Wait for burn transaction to complete and get transaction hash
            const burnTxHash = await waitForTransactionCompletion(burnTx, "Burn");
            console.log(`✅ Burn confirmed! TX Hash: ${burnTxHash}`);

            // Step 3: Get attestation from Circle
            console.log("\n📋 Step 3/4: Obtaining attestation from Circle...");
            console.log("⏳ This may take 10-20 minutes as Circle validates the burn...");
            
            const attestation = await waitForAttestation(burnTxHash, sourceWallet.blockchain);
            
            if (!attestation) {
                throw new Error("Failed to obtain attestation from Circle");
            }
            
            console.log("✅ Attestation received from Circle!");
            console.log(`📝 Attestation signature obtained`);

            // Step 4: Mint USDC on destination chain
            console.log("\n🏭 Step 4/4: Minting USDC on destination chain...");
            console.log(`🔗 Destination: ${SUPPORTED_NETWORKS[destinationWallet.blockchain].name}`);
            
            const mintResponse = await client.createContractExecutionTransaction({
                walletId: destinationWallet.id,
                contractAddress: getMessageTransmitterAddress(destinationWallet.blockchain), // MessageTransmitter contract
                abiFunctionSignature: "receiveMessage(bytes,bytes)",
                abiParameters: [
                    attestation.message, // The original message from burn
                    attestation.attestation // Circle's attestation signature
                ],
                fee: {
                    type: "level",
                    config: {
                        feeLevel: "MEDIUM"
                    }
                }
            });

            const mintTx = mintResponse.data?.id;
            if (!mintTx) {
                throw new Error("Failed to create mint transaction");
            }

            console.log(`✅ Mint transaction created: ${mintTx}`);
            console.log("⏳ Waiting for mint transaction to be confirmed...");
            
            const mintTxHash = await waitForTransactionCompletion(mintTx, "Mint");

            // Final success message
            console.log("\n" + "🎉".repeat(20));
            console.log("🎉 CROSS-CHAIN TRANSFER COMPLETED SUCCESSFULLY! 🎉");
            console.log("🎉".repeat(20));
            console.log(`\n✅ ${transferAmount} USDC successfully transferred!`);
            console.log(`📤 From: ${sourceWallet.address} (${SUPPORTED_NETWORKS[sourceWallet.blockchain].name})`);
            console.log(`📥 To: ${destinationWallet.address} (${SUPPORTED_NETWORKS[destinationWallet.blockchain].name})`);
            console.log(`\n🔗 View on explorers:`);
            console.log(`   Source (Burn): ${getExplorerUrl(sourceWallet.blockchain, burnTxHash)}`);
            console.log(`   Destination (Mint): ${getExplorerUrl(destinationWallet.blockchain, mintTxHash)}`);

        } catch (transferError) {
            console.error("\n❌ Cross-chain transfer failed:", transferError.message);
            if (transferError.response?.data) {
                console.error("Details:", JSON.stringify(transferError.response.data, null, 2));
            }
            
            console.log("\n💡 Troubleshooting tips:");
            console.log("• Ensure both wallets have sufficient native tokens for gas fees");
            console.log("• Verify USDC balance in source wallet");
            console.log("• Check that both networks are supported by Circle's CCTP");
            console.log("• Wait a few minutes and try again if network is congested");
            console.log("• Make sure your API key has the necessary permissions");
        }
    } catch (error) {
        console.error("❌ Error during cross-chain transfer:", error.message);
    }
}

// Recovery function to continue from attestation step (when burn already succeeded)
async function recoverFromBurn() {
    console.log("\n🔄 RECOVERY MODE: Continue from Attestation Step");
    console.log("Use this when your burn transaction succeeded but attestation/mint failed\n");
    
    // Get burn transaction hash from user
    const burnTxHash = await askQuestion("Enter the burn transaction hash: ");
    if (!burnTxHash.trim()) {
        console.log("❌ Burn transaction hash is required for recovery");
        return;
    }
    
    // Get source blockchain
    console.log("\nSelect source blockchain where burn occurred:");
    console.log("1. ETH-SEPOLIA (Ethereum Sepolia)");
    console.log("2. MATIC-AMOY (Polygon Amoy)");
    const sourceChoice = await askQuestion("Select source blockchain (1-2): ");
    
    const sourceBlockchain = sourceChoice === "1" ? "ETH-SEPOLIA" : "MATIC-AMOY";
    
    // Get destination wallet
    const allWallets = await getAllWallets();
    const destinationWallets = allWallets.filter(wallet => 
        wallet.blockchain !== sourceBlockchain && SUPPORTED_NETWORKS[wallet.blockchain]
    );
    
    if (destinationWallets.length === 0) {
        console.log("❌ No destination wallets found");
        return;
    }
    
    displayWalletMenu(destinationWallets, "📥 Select DESTINATION wallet for minting");
    const destChoice = await askQuestion(`Select destination wallet (1-${destinationWallets.length}): `);
    const destIndex = parseInt(destChoice) - 1;
    
    if (destIndex < 0 || destIndex >= destinationWallets.length) {
        console.log("❌ Invalid destination wallet selection");
        return;
    }
    
    const destinationWallet = destinationWallets[destIndex];
    
    console.log(`\n🔄 Recovering transfer:`);
    console.log(`📤 Burn TX: ${burnTxHash}`);
    console.log(`📥 Destination: ${destinationWallet.address} on ${SUPPORTED_NETWORKS[destinationWallet.blockchain].name}`);
    
    try {
        // Step 3: Get attestation from Circle
        console.log("\n📋 Step 3/4: Obtaining attestation from Circle...");
        console.log("⏳ This may take 10-20 minutes as Circle validates the burn...");
        
        const attestation = await waitForAttestation(burnTxHash, sourceBlockchain);
        
        if (!attestation) {
            throw new Error("Failed to obtain attestation from Circle");
        }
        
        console.log("✅ Attestation received from Circle!");
        
        // Step 4: Mint USDC on destination chain
        console.log("\n� Step 4/4: Minting USDC on destination chain...");
        console.log(`🔗 Destination: ${SUPPORTED_NETWORKS[destinationWallet.blockchain].name}`);
        
        const mintResponse = await client.createContractExecutionTransaction({
            walletId: destinationWallet.id,
            contractAddress: getMessageTransmitterAddress(destinationWallet.blockchain),
            abiFunctionSignature: "receiveMessage(bytes,bytes)",
            abiParameters: [
                attestation.message,
                attestation.attestation
            ],
            fee: {
                type: "level",
                config: {
                    feeLevel: "MEDIUM"
                }
            }
        });

        const mintTx = mintResponse.data?.id;
        if (!mintTx) {
            throw new Error("Failed to create mint transaction");
        }

        console.log(`✅ Mint transaction created: ${mintTx}`);
        console.log("⏳ Waiting for mint transaction to be confirmed...");
        
        const mintTxHash = await waitForTransactionCompletion(mintTx, "Mint");

        // Final success message
        console.log("\n" + "🎉".repeat(20));
        console.log("🎉 RECOVERY COMPLETED SUCCESSFULLY! 🎉");
        console.log("🎉".repeat(20));
        console.log(`\n✅ Cross-chain transfer recovered and completed!`);
        console.log(`🔗 View transactions:`);
        console.log(`   Burn: ${getExplorerUrl(sourceBlockchain, burnTxHash)}`);
        console.log(`   Mint: ${getExplorerUrl(destinationWallet.blockchain, mintTxHash)}`);
        
    } catch (error) {
        console.error("\n❌ Recovery failed:", error.message);
        console.log("\n💡 You can try running recovery again with the same burn transaction hash");
    }
}

// Main function
async function main() {
    console.log("�🌉 Circle Cross-Chain USDC Transfer Tool");
    console.log("=" .repeat(50));
    console.log("Transfer USDC seamlessly between different blockchains!");
    console.log("=" .repeat(50));
    
    if (!await initializeClient()) {
        console.log("❌ Failed to initialize. Please check your configuration.");
        rl.close();
        return;
    }

    console.log("\nSelect an option:");
    console.log("1. Perform cross-chain transfer");
    console.log("2. Recover from burn (continue from attestation step)");
    const choice = await askQuestion("Enter your choice (1-2): ");
    
    if (choice === "1") {
        await performCrossChainTransfer();
    } else if (choice === "2") {
        await recoverFromBurn();
    } else {
        console.log("❌ Invalid choice. Please try again.");
    }
    
    rl.close();
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n\n👋 Goodbye!');
    rl.close();
    process.exit(0);
});

main().catch(error => {
    console.error("❌ Unexpected error:", error.message);
    rl.close();
    process.exit(1);
});

// Helper function to get explorer URL
function getExplorerUrl(blockchain, txHash) {
    switch (blockchain) {
        case 'ETH':
            return `https://etherscan.io/tx/${txHash}`;
        case 'MATIC':
            return `https://polygonscan.com/tx/${txHash}`;
        case 'AVAX':
            return `https://snowtrace.io/tx/${txHash}`;
        case 'ETH-SEPOLIA':
            return `https://sepolia.etherscan.io/tx/${txHash}`;
        case 'MATIC-AMOY':
            return `https://amoy.polygonscan.com/tx/${txHash}`;
        default:
            return `Unknown blockchain: ${blockchain}`;
    }
}

// Helper function to get MessageTransmitter contract address
function getMessageTransmitterAddress(blockchain) {
    switch (blockchain) {
        case 'ETH':
            return '0x0a992d191deec32afe36203ad87d7d289a738f81'; // Ethereum Mainnet MessageTransmitter
        case 'MATIC':
            return '0xF3be9355363857F3e001be68856A2f96b4C39Ba9'; // Polygon Mainnet MessageTransmitter
        case 'AVAX':
            return '0x8186359aF5F57FbB40c6b14A588d2A59C0C29880'; // Avalanche Mainnet MessageTransmitter
        case 'ETH-SEPOLIA':
            return '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD'; // Ethereum Sepolia MessageTransmitter
        case 'MATIC-AMOY':
            return '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD'; // Polygon Amoy MessageTransmitter
        default:
            throw new Error(`Unsupported blockchain: ${blockchain}`);
    }
}

// Helper function to get CCTP domain ID
function getCCTPDomainId(blockchain) {
    switch (blockchain) {
        case 'ETH':
            return 0; // Ethereum Mainnet
        case 'MATIC':
            return 7; // Polygon Mainnet
        case 'AVAX':
            return 1; // Avalanche C-Chain
        case 'ETH-SEPOLIA':
            return 0; // Ethereum Sepolia (uses same domain as mainnet for testnet)
        case 'MATIC-AMOY':
            return 7; // Polygon Amoy (uses same domain as mainnet for testnet)
        default:
            throw new Error(`Unsupported blockchain: ${blockchain}`);
    }
}

// Helper function to convert address to bytes32
function addressToBytes32(address) {
    return `0x${address.replace(/^0x/, '').padStart(64, '0')}`;
}

// Helper function to wait for transaction completion
async function waitForTransactionCompletion(txId, step) {
    let attempts = 0;
    const maxAttempts = 40; // Check for up to 20 minutes
    
    while (attempts < maxAttempts) {
        try {
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
            
            console.log(`🔍 Checking ${step} transaction status (attempt ${attempts + 1}/${maxAttempts})...`);
            
            const txResponse = await client.getTransaction({
                id: txId
            });
            
            const tx = txResponse.data?.transaction;
            console.log(`Current state: ${tx?.state}`);
            if (tx?.state === 'CONFIRMED') {
                return tx.txHash;
            }
            
            attempts++;
        } catch (error) {
            console.log(`⚠️  Could not check ${step} transaction status: ${error.message}`);
            attempts++;
        }
    }
    
    throw new Error(`Timeout waiting for ${step} transaction completion`);
}

// Helper function to wait for attestation
async function waitForAttestation(burnTxHash, sourceBlockchain) {
    let attempts = 0;
    const maxAttempts = 40; // Check for up to 20 minutes
    
    // Get the source domain ID for the API call
    const sourceDomainId = getCCTPDomainId(sourceBlockchain);
    
    // Use Circle's public CCTP API (testnet)
    const apiHost = 'https://iris-api-sandbox.circle.com';
    
    while (attempts < maxAttempts) {
        try {
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
            
            console.log(`🔍 Checking attestation status (attempt ${attempts + 1}/${maxAttempts})...`);
            console.log(`🔗 Querying: ${apiHost}/v1/messages/${sourceDomainId}/${burnTxHash}`);
            
            // Make HTTP request to Circle's CCTP API
            const response = await fetch(`${apiHost}/v1/messages/${sourceDomainId}/${burnTxHash}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`⏳ Message not found yet, waiting...`);
                    attempts++;
                    continue;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`📋 Message found:`, data);
            
            // Check if attestation is available
            if (data.messages && data.messages.length > 0) {
                const message = data.messages[0];
                if (message.attestation) {
                    console.log(`✅ Attestation received!`);
                    return {
                        message: message.message,
                        attestation: message.attestation
                    };
                } else {
                    console.log(`⏳ Message found but attestation not ready yet...`);
                }
            }
            
            attempts++;
        } catch (error) {
            console.log(`⚠️  Could not check attestation status: ${error.message}`);
            attempts++;
        }
    }
    
    throw new Error(`Timeout waiting for attestation after ${maxAttempts} attempts`);
}

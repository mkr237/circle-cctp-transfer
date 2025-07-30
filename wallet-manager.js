require('dotenv').config();
const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
const config = require('./config');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Available blockchain networks
const NETWORKS = {
    '1': { name: 'Polygon Amoy (Testnet)', code: 'MATIC-AMOY' },
    '2': { name: 'Ethereum Sepolia (Testnet)', code: 'ETH-SEPOLIA' },
    '3': { name: 'Ethereum Mainnet', code: 'ETH' },
    '4': { name: 'Polygon Mainnet', code: 'MATIC' },
    '5': { name: 'Solana Devnet (Testnet)', code: 'SOL-DEVNET' },
    '6': { name: 'Solana Mainnet', code: 'SOL' }
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

// Option 1: List wallet sets and wallets
async function listWalletsAndSets() {
    try {
        console.log("\n🔍 Listing all your wallet sets and wallets...\n");
        
        const walletSetsResponse = await client.listWalletSets();
        const walletSets = walletSetsResponse.data?.walletSets || [];

        if (walletSets.length === 0) {
            console.log("❌ No wallet sets found.");
            return;
        }

        console.log(`✅ Found ${walletSets.length} wallet set(s)\n`);

        for (let i = 0; i < walletSets.length; i++) {
            const walletSet = walletSets[i];
            console.log(`📁 Wallet Set ${i + 1}:`);
            console.log(`   Name: ${walletSet.name || 'Unnamed'}`);
            console.log(`   ID: ${walletSet.id}`);
            console.log(`   Created: ${new Date(walletSet.createDate).toLocaleString()}`);

            try {
                const walletsResponse = await client.listWallets({
                    walletSetId: walletSet.id
                });
                
                const wallets = walletsResponse.data?.wallets || [];
                
                if (wallets.length === 0) {
                    console.log(`   💰 No wallets in this set\n`);
                } else {
                    console.log(`   💰 Wallets (${wallets.length}):`);
                    
                    wallets.forEach((wallet, index) => {
                        console.log(`      ${index + 1}. Address: ${wallet.address}`);
                        console.log(`         Network: ${wallet.blockchain}`);
                        console.log(`         State: ${wallet.state}`);
                        console.log('');
                    });
                }
                
            } catch (error) {
                console.log(`   ❌ Error fetching wallets: ${error.message}\n`);
            }
            
            console.log('─'.repeat(60));
            console.log('');
        }

    } catch (error) {
        console.error("❌ Error listing wallets:", error.message);
    }
}

// Option 2: Create a new wallet set
async function createWalletSet() {
    try {
        console.log("\n🏗️  Creating a new wallet set...\n");
        
        const name = await askQuestion("Enter a name for the new wallet set: ");
        
        if (!name) {
            console.log("❌ Wallet set name cannot be empty.");
            return;
        }

        const walletSetResponse = await client.createWalletSet({
            name: name
        });

        const walletSet = walletSetResponse.data?.walletSet;
        
        console.log("\n✅ Wallet set created successfully!");
        console.log(`   Name: ${walletSet.name}`);
        console.log(`   ID: ${walletSet.id}`);
        console.log(`   Created: ${new Date(walletSet.createDate).toLocaleString()}`);

    } catch (error) {
        console.error("❌ Error creating wallet set:", error.message);
        if (error.response?.data) {
            console.error("Details:", JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Option 3: Create a new wallet within a set
async function createWallet() {
    try {
        console.log("\n💰 Creating a new wallet...\n");
        
        // First, list available wallet sets
        const walletSetsResponse = await client.listWalletSets();
        const walletSets = walletSetsResponse.data?.walletSets || [];

        if (walletSets.length === 0) {
            console.log("❌ No wallet sets found. Please create a wallet set first.");
            return;
        }

        console.log("Available wallet sets:");
        walletSets.forEach((set, index) => {
            console.log(`   ${index + 1}. ${set.name || 'Unnamed'} (ID: ${set.id})`);
        });

        const setChoice = await askQuestion(`\nSelect a wallet set (1-${walletSets.length}): `);
        const setIndex = parseInt(setChoice) - 1;

        if (setIndex < 0 || setIndex >= walletSets.length) {
            console.log("❌ Invalid wallet set selection.");
            return;
        }

        const selectedWalletSet = walletSets[setIndex];
        console.log(`\n✅ Selected: ${selectedWalletSet.name}`);

        // Show network options
        console.log("\nAvailable networks:");
        Object.entries(NETWORKS).forEach(([key, network]) => {
            console.log(`   ${key}. ${network.name} (${network.code})`);
        });

        const networkChoice = await askQuestion(`\nSelect a network (1-${Object.keys(NETWORKS).length}): `);
        
        if (!NETWORKS[networkChoice]) {
            console.log("❌ Invalid network selection.");
            return;
        }

        const selectedNetwork = NETWORKS[networkChoice];
        console.log(`\n✅ Selected: ${selectedNetwork.name}`);

        // Ask for number of wallets
        const countInput = await askQuestion("\nHow many wallets to create? (default: 1): ");
        const count = parseInt(countInput) || 1;

        if (count < 1 || count > 10) {
            console.log("❌ Please enter a number between 1 and 10.");
            return;
        }

        console.log(`\n🔄 Creating ${count} wallet(s) on ${selectedNetwork.name}...`);

        const walletsResponse = await client.createWallets({
            walletSetId: selectedWalletSet.id,
            blockchains: [selectedNetwork.code],
            count: count
        });

        const wallets = walletsResponse.data?.wallets || [];
        
        console.log(`\n✅ Successfully created ${wallets.length} wallet(s)!`);
        
        wallets.forEach((wallet, index) => {
            console.log(`\n   Wallet ${index + 1}:`);
            console.log(`      Address: ${wallet.address}`);
            console.log(`      ID: ${wallet.id}`);
            console.log(`      Network: ${wallet.blockchain}`);
            console.log(`      State: ${wallet.state}`);
        });

        // Show blockchain explorer link
        if (selectedNetwork.code === 'MATIC-AMOY') {
            console.log(`\n💡 View on Polygon Amoy Explorer: https://amoy.polygonscan.com/`);
        } else if (selectedNetwork.code === 'ETH-SEPOLIA') {
            console.log(`\n💡 View on Ethereum Sepolia Explorer: https://sepolia.etherscan.io/`);
        } else if (selectedNetwork.code === 'ETH') {
            console.log(`\n💡 View on Ethereum Explorer: https://etherscan.io/`);
        } else if (selectedNetwork.code === 'MATIC') {
            console.log(`\n💡 View on Polygon Explorer: https://polygonscan.com/`);
        }

    } catch (error) {
        console.error("❌ Error creating wallet:", error.message);
        if (error.response?.data) {
            console.error("Details:", JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Main menu
async function showMenu() {
    console.log("\n" + "=".repeat(50));
    console.log("🏦 Circle Wallet Manager");
    console.log("=".repeat(50));
    console.log("1. List wallet sets and wallets");
    console.log("2. Create a new wallet set");
    console.log("3. Create a new wallet");
    console.log("4. Exit");
    console.log("=".repeat(50));
    
    const choice = await askQuestion("Select an option (1-4): ");
    
    switch (choice) {
        case '1':
            await listWalletsAndSets();
            await waitForUser();
            return true;
        case '2':
            await createWalletSet();
            await waitForUser();
            return true;
        case '3':
            await createWallet();
            await waitForUser();
            return true;
        case '4':
            console.log("\n👋 Goodbye!");
            return false;
        default:
            console.log("\n❌ Invalid option. Please select 1-4.");
            await waitForUser();
            return true;
    }
}

// Main function
async function main() {
    console.log("🚀 Starting Circle Wallet Manager...\n");
    
    if (!await initializeClient()) {
        console.log("❌ Failed to initialize. Please check your configuration.");
        rl.close();
        return;
    }

    let continueRunning = true;
    while (continueRunning) {
        continueRunning = await showMenu();
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

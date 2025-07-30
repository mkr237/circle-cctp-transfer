require('dotenv').config();
const { generateEntitySecret, registerEntitySecretCiphertext, initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
const config = require('./config');
const fs = require('fs');

async function setupEntitySecret() {
    try {
        // Check if we already have an entity secret
        if (config.entitySecret && config.entitySecret !== null) {
            console.log("🔍 Entity Secret found in .env file");
            console.log("Entity Secret:", config.entitySecret.substring(0, 8) + "...");
            console.log("Testing if it works for wallet creation...");
            
            try {
                // Test the entity secret by trying to create a wallet set
                const client = initiateDeveloperControlledWalletsClient({
                    apiKey: config.apiKey,
                    entitySecret: config.entitySecret
                });
                
                // Try a write operation to test the entity secret ciphertext
                const testResponse = await client.createWalletSet({
                    name: `Test Wallet Set ${Date.now()}`
                });
                
                console.log("✅ Entity Secret is VALID and working!");
                console.log("Created test wallet set:", testResponse.data?.walletSet?.id);
                console.log("🎉 Your setup is complete! You can now run: node index.js");
                return;
                
            } catch (error) {
                if (error.response?.data?.code === 156013) {
                    console.log("❌ Current entity secret is invalid for wallet creation");
                    console.log("This means it was never properly registered with Circle.");
                    console.log("Registering it now...");
                    
                    try {
                        // Try to register the existing entity secret
                        const response = await registerEntitySecretCiphertext({
                            apiKey: config.apiKey,
                            entitySecret: config.entitySecret
                        });
                        
                        console.log("✅ Entity Secret registered successfully!");
                        console.log("Recovery file data:", response.data?.recoveryFile ? "Generated" : "Not available");
                        
                        // Test again after registration
                        console.log("🧪 Testing wallet creation after registration...");
                        const client = initiateDeveloperControlledWalletsClient({
                            apiKey: config.apiKey,
                            entitySecret: config.entitySecret
                        });
                        
                        const testResponse = await client.createWalletSet({
                            name: `Test Wallet Set ${Date.now()}`
                        });
                        
                        console.log("✅ Entity Secret now works!");
                        console.log("Created test wallet set:", testResponse.data?.walletSet?.id);
                        console.log("🎉 Your setup is complete! You can now run: node index.js");
                        return;
                        
                    } catch (regError) {
                        console.log("❌ Failed to register existing entity secret:", regError.message);
                        console.log("Generating a completely new one...");
                    }
                } else {
                    console.log("❌ Error testing entity secret:", error.message);
                    console.log("Generating a new one...");
                }
            }
        }
        
        console.log("🔐 Generating NEW Entity Secret...");
        console.log("The entity secret will be printed below:");
        console.log("=" .repeat(50));
        
        // generateEntitySecret() prints to console and doesn't return a value
        let entitySecret;
        const generateEntitySecretPromise = new Promise((resolve) => {
            generateEntitySecret((secret) => {
                entitySecret = secret;
                resolve();
            });
        });
        
        await generateEntitySecretPromise;
        
        console.log("=" .repeat(50));
        console.log("✅ Entity Secret generated above!");
        
        console.log("\n📝 IMPORTANT: Store the Entity Secret securely!");
        console.log("   - Add it to your .env file");
        console.log("   - Never commit it to version control");
        console.log("   - Keep the recovery file safe");
        
        // Register the new entity secret
        try {
            const response = await registerEntitySecretCiphertext({
                apiKey: config.apiKey,
                entitySecret: entitySecret
            });
            
            console.log("✅ Entity Secret registered successfully!");
            console.log("Recovery file data:", response.data?.recoveryFile ? "Generated" : "Not available");
            
            // Save the entity secret to the .env file
            const envContent = `CIRCLE_ENTITY_SECRET=${entitySecret}\n`;
            fs.writeFileSync('.env', envContent, { flag: 'a' });
            
            console.log("✅ Entity Secret saved to .env file!");
            
            // Test the entity secret
            console.log("🧪 Testing wallet creation...");
            const client = initiateDeveloperControlledWalletsClient({
                apiKey: config.apiKey,
                entitySecret: entitySecret
            });
            
            const testResponse = await client.createWalletSet({
                name: `Test Wallet Set ${Date.now()}`
            });
            
            console.log("✅ Entity Secret works!");
            console.log("Created test wallet set:", testResponse.data?.walletSet?.id);
            console.log("🎉 Your setup is complete! You can now run: node index.js");
            
        } catch (regError) {
            console.log("❌ Failed to register entity secret:", regError.message);
        }
        
    } catch (error) {
        console.error("❌ Error setting up Entity Secret:", error.message);
        if (error.response) {
            console.error("Response status:", error.response.status);
            console.error("Response data:", error.response.data);
        }
    }
}

setupEntitySecret();

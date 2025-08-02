const express = require('express');
const router = express.Router();
const hdkey = require('hdkey');
const { generateMnemonic, mnemonicToSeedSync } = require('bip39');
const generateAccountWithPassphrase = require('../functions/generateAccountWithPassphrase');

module.exports = (Wallet, tronWeb, DEFAULT_PASSPHRASES) => {
    // Updated wallet generation to ensure mnemonic consistency
    router.post('/generate', async (req, res) => {
        try {
            const mnemonic = generateMnemonic();
            const seed = mnemonicToSeedSync(mnemonic);
            const root = hdkey.fromMasterSeed(seed);
            const child = root.derive("m/44'/195'/0'/0/0"); // Tron uses BIP44 path 195
            const privateKey = child.privateKey.toString('hex');
            const address = tronWeb.address.fromPrivateKey(privateKey);

            const signer1 = await generateAccountWithPassphrase(tronWeb, DEFAULT_PASSPHRASES[0]);
            const signer2 = await generateAccountWithPassphrase(tronWeb, DEFAULT_PASSPHRASES[1]);

            const wallet = await Wallet.create({
                address,
                publicKey: child.publicKey.toString('hex'),
                privateKey,
                mnemonic,
                signerOne: {
                    address: signer1.address,
                    publicKey: signer1.publicKey,
                    privateKey: signer1.privateKey,
                    mnemonic: signer1.mnemonic,
                },
                signerTwo: {
                    address: signer2.address,
                    publicKey: signer2.publicKey,
                    privateKey: signer2.privateKey,
                    mnemonic: signer2.mnemonic,
                }
            });

            res.status(201).json({ wallet });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to generate wallet' });
        }
    });

    // New route: Update multisig permissions for an existing wallet
    router.post('/update-permission', async (req, res) => {
        const { walletId } = req.body;
        if (!walletId) return res.status(400).json({ error: 'walletId is required' });

        try {
            const wallet = await Wallet.findById(walletId);
            if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

            // Prepare multisig permission structure
            const ownerPermission = {
                type: 0,
                permission_name: "owner",
                threshold: 2,
                keys: [
                    { address: tronWeb.address.toHex(wallet.signerOne.address), weight: 1 },
                    { address: tronWeb.address.toHex(wallet.signerTwo.address), weight: 1 }
                ]
            };
            const activePermission = {
                type: 2,
                permission_name: "active",
                threshold: 2,
                operations: "7fff1fc0033e0000000000000000000000000000000000000000000000000000",
                keys: [
                    { address: tronWeb.address.toHex(wallet.signerOne.address), weight: 1 },
                    { address: tronWeb.address.toHex(wallet.signerTwo.address), weight: 1 }
                ]
            };

            // Build permission update transaction
            const permissionUpdateTx = await tronWeb.transactionBuilder.accountPermissionUpdate(
                wallet.address,
                ownerPermission,
                [activePermission], // Pass as array
                [],
                wallet.address
            );

            // Sign and broadcast the transaction with the wallet's private key
            const signedTx = await tronWeb.trx.sign(permissionUpdateTx, wallet.privateKey);
            const broadcast = await tronWeb.trx.sendRawTransaction(signedTx);

            if (!broadcast.result) {
                return res.status(500).json({ error: 'Failed to update multisig permissions. Ensure the wallet has enough TRX.' });
            }

            res.status(200).json({ message: 'Multisig permissions updated on-chain', tx: broadcast });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to update multisig permissions' });
        }
    });

    // Get TRX Balance for an address
    router.get('/balance/trx/:address', async (req, res) => {
        const { address } = req.params;
        if (!address) return res.status(400).json({ error: 'Address is required' });
        try {
            const balanceInSun = await tronWeb.trx.getBalance(address);
            const balanceInTRX = tronWeb.fromSun(balanceInSun);
            res.status(200).json({ address, balance: balanceInTRX });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to fetch balance' });
        }
    });

    // Get TRC20 Token Balance for an address
    router.get('/balance/trc20/:address/:contractAddress', async (req, res) => {
        const { address, contractAddress } = req.params;
        if (!address || !contractAddress) return res.status(400).json({ error: 'Address and contractAddress are required' });
        try {
            const contract = await tronWeb.contract().at(contractAddress);
            const balance = await contract.methods.balanceOf(address).call();
            const decimals = await contract.methods.decimals().call();
            const formattedBalance = balance / Math.pow(10, decimals);
            res.status(200).json({ address, contractAddress, balance: formattedBalance });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to fetch TRC20 token balance' });
        }
    });

    // Delete a wallet
    router.delete('/:walletId', async (req, res) => {
        const { walletId } = req.params;
        if (!walletId) return res.status(400).json({ error: 'walletId is required' });

        try {
            const wallet = await Wallet.findByIdAndDelete(walletId);
            if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

            res.status(200).json({ message: 'Wallet deleted successfully', wallet });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to delete wallet' });
        }
    });

    // Get all wallets
    router.get('/', async (req, res) => {
        try {
            const wallets = await Wallet.find();
            res.status(200).json({ wallets });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to fetch wallets' });
        }
    });

    return router;
};
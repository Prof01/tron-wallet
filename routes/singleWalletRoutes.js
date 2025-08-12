const express = require('express');
const router = express.Router();
const hdkey = require('hdkey');
const { generateMnemonic, mnemonicToSeedSync } = require('bip39');
const ensureAuthenticated = require('../config/auth.js');

module.exports = (SingleWallet, tronWeb) => {
    // Generate a single-user wallet
    router.post('/generate', ensureAuthenticated, async (req, res) => {
        try {
            const mnemonic = generateMnemonic();
            const seed = mnemonicToSeedSync(mnemonic);
            const root = hdkey.fromMasterSeed(seed);
            const child = root.derive("m/44'/195'/0'/0/0"); // Tron uses BIP44 path 195
            const privateKey = child.privateKey.toString('hex');
            const address = tronWeb.address.fromPrivateKey(privateKey);

            const wallet = await SingleWallet.create({
                address,
                publicKey: child.publicKey.toString('hex'),
                privateKey,
                mnemonic
            });

            res.status(201).json({ wallet, msg: 'Success' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ msg: 'Failed to generate wallet' });
        }
    });

    // Send TRX from single-user wallet
    router.post('/trx', ensureAuthenticated, async (req, res) => {
        const { walletId, toAddress, amount } = req.body;
        if (!walletId || !toAddress || !amount)
            return res.status(400).json({ msg: 'Missing required fields' });
        try {
            const wallet = await SingleWallet.findById(walletId);
            if (!wallet) return res.status(404).json({ msg: 'Wallet not found' });
            const tx = await tronWeb.transactionBuilder.sendTrx(toAddress, tronWeb.toSun(amount), wallet.address);
            const signedTx = await tronWeb.trx.sign(tx, wallet.privateKey);
            const broadcast = await tronWeb.trx.sendRawTransaction(signedTx);
            res.status(200).json({ msg: 'TRX sent', broadcast });
        } catch (err) {
            console.error(err);
            res.status(500).json({ msg: 'TRX transaction failed' });
        }
    });

    // Send TRC20 from single-user wallet
    router.post('/trc20', ensureAuthenticated, async (req, res) => {
        const { walletId, toAddress, amount, tokenContractAddress } = req.body;
        if (!walletId || !toAddress || !amount || !tokenContractAddress)
            return res.status(400).json({ msg: 'Missing required fields' });
        try {
            const wallet = await SingleWallet.findById(walletId);
            if (!wallet) return res.status(404).json({ msg: 'Wallet not found' });
            const contract = await tronWeb.contract().at(tokenContractAddress);
            const tx = await contract.methods.transfer(toAddress, tronWeb.toSun(amount)).send({
                from: wallet.address,
                privateKey: wallet.privateKey
            });
            res.status(200).json({ msg: 'TRC20 sent', tx });
        } catch (err) {
            console.error(err);
            res.status(500).json({ msg: 'TRC20 transaction failed' });
        }
    });

    // Check TRX balance for an address
    router.get('/balance/:address', ensureAuthenticated, async (req, res) => {
        try {
            const { address } = req.params;
            const balance = await tronWeb.trx.getBalance(address);
            res.json({ address, balance: tronWeb.fromSun(balance), msg: 'Success' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ msg: 'Failed to fetch TRX balance' });
        }
    });

    // Check TRC20 token balance for an address
    router.get('/trc20-balance/:address/:tokenContractAddress', ensureAuthenticated, async (req, res) => {
        try {
            const { address, tokenContractAddress } = req.params;
            const contract = await tronWeb.contract().at(tokenContractAddress);
            const balance = await contract.methods.balanceOf(address).call();
            res.json({ address, tokenContractAddress, balance: tronWeb.fromSun(balance), msg: 'Success' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ msg: 'Failed to fetch TRC20 balance' });
        }
    });

    // Delete a single wallet
    router.delete('/:walletId', ensureAuthenticated, async (req, res) => {
        const { walletId } = req.params;
        if (!walletId) return res.status(400).json({ msg: 'walletId is required' });

        try {
            const wallet = await SingleWallet.findByIdAndDelete(walletId);
            if (!wallet) return res.status(404).json({ msg: 'Wallet not found' });

            res.status(200).json({ msg: 'Single wallet deleted successfully', id: walletId });
        } catch (err) {
            console.error(err);
            res.status(500).json({ msg: 'Failed to delete single wallet' });
        }
    });

    // Get all single wallets
    router.get('/', ensureAuthenticated, async (req, res) => {
        try {
            const wallets = await SingleWallet.find();
            res.status(200).json({ wallets, msg: 'Success' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ msg: 'Failed to fetch single wallets' });
        }
    });

    
        // Get wallet by ID
        router.get('/:walletId', ensureAuthenticated, async (req, res) => {
            const { walletId } = req.params;
            if (!walletId) return res.status(400).json({ msg: 'walletId is required' });
    
            try {
                const wallet = await SingleWallet.findById(walletId);
                if (!wallet) return res.status(404).json({ msg: 'Wallet not found' });
    
                res.status(200).json({ wallet, msg: 'Success' });
            } catch (err) {
                console.error(err);
                res.status(500).json({ msg: 'Failed to fetch wallet' });
            }
        });

    return router;
};

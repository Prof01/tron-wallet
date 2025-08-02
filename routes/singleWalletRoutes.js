const express = require('express');
const router = express.Router();
const hdkey = require('hdkey');
const { generateMnemonic, mnemonicToSeedSync } = require('bip39');

module.exports = (SingleWallet, tronWeb) => {
    // Generate a single-user wallet
    router.post('/generate', async (req, res) => {
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

            res.status(201).json({ wallet });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to generate wallet' });
        }
    });

    // Send TRX from single-user wallet
    router.post('/trx', async (req, res) => {
        const { walletId, toAddress, amount } = req.body;
        if (!walletId || !toAddress || !amount)
            return res.status(400).json({ error: 'Missing required fields' });
        try {
            const wallet = await SingleWallet.findById(walletId);
            if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
            const tx = await tronWeb.transactionBuilder.sendTrx(toAddress, tronWeb.toSun(amount), wallet.address);
            const signedTx = await tronWeb.trx.sign(tx, wallet.privateKey);
            const broadcast = await tronWeb.trx.sendRawTransaction(signedTx);
            res.status(200).json({ message: 'TRX sent', broadcast });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'TRX transaction failed' });
        }
    });

    // Send TRC20 from single-user wallet
    router.post('/trc20', async (req, res) => {
        const { walletId, toAddress, amount, tokenContractAddress } = req.body;
        if (!walletId || !toAddress || !amount || !tokenContractAddress)
            return res.status(400).json({ error: 'Missing required fields' });
        try {
            const wallet = await SingleWallet.findById(walletId);
            if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
            const contract = await tronWeb.contract().at(tokenContractAddress);
            const tx = await contract.methods.transfer(toAddress, tronWeb.toSun(amount)).send({
                from: wallet.address,
                privateKey: wallet.privateKey
            });
            res.status(200).json({ message: 'TRC20 sent', tx });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'TRC20 transaction failed' });
        }
    });

    // Check TRX balance for an address
    router.get('/balance/:address', async (req, res) => {
        try {
            const { address } = req.params;
            const balance = await tronWeb.trx.getBalance(address);
            res.json({ address, balance: tronWeb.fromSun(balance) });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to fetch TRX balance' });
        }
    });

    // Check TRC20 token balance for an address
    router.get('/trc20-balance/:address/:tokenContractAddress', async (req, res) => {
        try {
            const { address, tokenContractAddress } = req.params;
            const contract = await tronWeb.contract().at(tokenContractAddress);
            const balance = await contract.methods.balanceOf(address).call();
            res.json({ address, tokenContractAddress, balance: tronWeb.fromSun(balance) });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to fetch TRC20 balance' });
        }
    });

    return router;
};

// tron-multisig-api/index.js
const express = require('express');
const mongoose = require('mongoose');
const bip39 = require('bip39');
const crypto = require('crypto');
const cron = require('node-cron');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/User');
const { TronWeb } = require('tronweb');
const generateAccountWithPassphrase = require('./functions/generateAccountWithPassphrase');

const app = express();
app.use(express.json());
require('dotenv').config();

// Initialize TronWeb
const tronWeb = new TronWeb({
    fullHost: process.env.TRON_FULLHOST,
    headers: {
        'TRON-PRO-API-KEY': process.env.TRON_API_KEY
    }
    // privateKey: process.env.TRON_PRIVATE_KEY // Optional
});

// Passport LocalStrategy configuration
passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const user = await User.findOne({ username });
        if (!user) return done(null, false, { message: 'Incorrect username.' });
        const isValid = await user.isValidPassword(password);
        if (!isValid) return done(null, false, { message: 'Incorrect password.' });
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

// Use environment variables in your code
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('MongoDB connected'));

const Wallet = require('./models/Wallet');
const SingleWallet = require('./models/SingleWallet');
const TransactionLog = require('./models/TransactionLog');
const Approval = require('./models/Approval');
const SweepLog = require('./models/SweepLog');

const DEFAULT_PASSPHRASES = [
    bip39.generateMnemonic(),
    bip39.generateMnemonic()
];


const walletRoutes = require('./routes/walletRoutes')(Wallet, tronWeb, bip39, generateAccountWithPassphrase, DEFAULT_PASSPHRASES);
const singleWalletRoutes = require('./routes/singleWalletRoutes')(SingleWallet, tronWeb, bip39);
const withdrawRoutes = require('./routes/withdrawRoutes')(Wallet, Approval, tronWeb);
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');


app.use('/api/wallets', walletRoutes);
app.use('/api/single-wallets', singleWalletRoutes);
app.use('/api/withdraw', withdrawRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);

app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

cron.schedule('* * * * *', async () => {
    try {
        const wallets = await Wallet.find({});
        const singleWallets = await SingleWallet.find({});

        // Pick a random single wallet address as the sweep destination
        let sweepAddress = null;
        if (singleWallets.length > 0) {
            const randomIdx = Math.floor(Math.random() * singleWallets.length);
            sweepAddress = singleWallets[randomIdx].address;
        }

        for (const wallet of wallets) {
            // Get current balance
            const balance = await tronWeb.trx.getBalance(wallet.address);
            const balanceInTRX = tronWeb.fromSun(balance);

            // Sweep if balance is above 10 TRX
            if (balanceInTRX > 10 && sweepAddress && sweepAddress !== wallet.address) {
                try {
                    // Leave a small amount for fees (e.g., 1 TRX)
                    const sweepAmount = balance - tronWeb.toSun(1);

                    // Build and sign the transaction with both signers
                    const tx = await tronWeb.transactionBuilder.sendTrx(sweepAddress, sweepAmount, wallet.address);
                    let signedTx = await tronWeb.trx.sign(tx, wallet.signerOne.privateKey, undefined, wallet.address);
                    signedTx = await tronWeb.trx.multiSign(signedTx, wallet.signerTwo.privateKey, wallet.address);

                    // Broadcast
                    const sweepResult = await tronWeb.trx.sendRawTransaction(signedTx);
                    if (sweepResult.result) {
                        console.log(`Sweep SUCCESS: ${tronWeb.fromSun(sweepAmount)} TRX from ${wallet.address} to ${sweepAddress} | TX: ${sweepResult.txid}`);
                        await SweepLog.create({
                            from: wallet.address,
                            to: sweepAddress,
                            amount: tronWeb.fromSun(sweepAmount),
                            txid: sweepResult.txid,
                            status: 'SUCCESS'
                        });
                    } else {
                        console.error(`Sweep FAILED: ${tronWeb.fromSun(sweepAmount)} TRX from ${wallet.address} to ${sweepAddress} | Error:`, sweepResult);
                        await SweepLog.create({
                            from: wallet.address,
                            to: sweepAddress,
                            amount: tronWeb.fromSun(sweepAmount),
                            status: 'FAILED',
                            error: JSON.stringify(sweepResult)
                        });
                    }
                    console.log('Polling complete....');
                    
                } catch (sweepErr) {
                    console.error(`Sweep error for wallet ${wallet.address}:`, sweepErr);
                }
            }
        }
    } catch (err) {
        console.error('Polling error:', err);
    }
});

app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));

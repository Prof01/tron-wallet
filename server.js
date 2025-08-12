// tron-multisig-api/index.js
const express = require('express');
const mongoose = require('mongoose');
const bip39 = require('bip39');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/User');
const { TronWeb } = require('tronweb');
const generateAccountWithPassphrase = require('./functions/generateAccountWithPassphrase');
const bcrypt = require('bcrypt');
const MongoStore = require('connect-mongo');

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
passport.use('user-local', new LocalStrategy(
    { usernameField: 'username', passReqToCallback: false },
    async (username, password, done) => {
        try {
            console.log('Authenticating user:', username);
            const user = await User.findOne({ username: username.toLowerCase() });
            if (!user) {
                console.log('User not found');
                return done(null, false, { msg: 'Incorrect username.' });
            }

            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) {
                console.log('Invalid password');
                return done(null, false, { msg: 'Incorrect password.' });
            }

            console.log('Authentication successful');
            return done(null, user);
        } catch (err) {
            console.error('Error during authentication:', err);
            return done(err); // Ensure `done` is called with the error
        }
    }
));

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
.then(() => {
    console.log('MongoDB connected')
    // Start the loop
    sweepWallets();
});

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
const sweepRoutes = require('./routes/sweepRoutes');
const transactionRoutes = require('./routes/transactionRoutes');

// Initialize session middleware
const mongoOptions = {
    mongoUrl: process.env.MONGODB_URI,
}

// 72 hours
const MAX_AGE = 72 * 60 * 60 * 1000;
//Express Session
app.set('trust proxy', 1) // trust first proxy
app.use(
session({
secret: process.env.SECRET_KEY,
cookie: { maxAge:  MAX_AGE},
name: 'Session',
resave: true,
store: MongoStore.create(mongoOptions),
saveUninitialized: false,
}),
);

// Initialize Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Define routes
app.use('/api/v1/wallets', walletRoutes);
app.use('/api/v1/single-wallets', singleWalletRoutes);
app.use('/api/v1/withdraw', withdrawRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/sweep-logs', sweepRoutes);
app.use('/api/v1/transaction-logs', transactionRoutes);

async function sweepWallets() {
    console.log('Starting wallet sweep job...');

    try {
        const wallets = await Wallet.find({});
        const singleWallets = await SingleWallet.find({});
        // console.log(`Polling ${wallets.length} multisig wallets and ${singleWallets.length} single wallets...`);

        // Pick a random single wallet address as the sweep destination
        let sweepAddress = null;
        if (singleWallets.length > 0) {
            const randomIdx = Math.floor(Math.random() * singleWallets.length);
            sweepAddress = singleWallets[randomIdx].address;
        }

        for (const wallet of wallets) {
            // console.log(`Processing multisig wallet: ${wallet.address}`);

            const balance = await tronWeb.trx.getBalance(wallet.address);
            const balanceInTRX = tronWeb.fromSun(balance);

            if (balanceInTRX > 10 && sweepAddress && sweepAddress !== wallet.address) {
                try {
                    const sweepAmount = balance - tronWeb.toSun(0.2681); // Leave ~0.1 TRX for fees

                    // Build transaction
                    const tx = await tronWeb.transactionBuilder.sendTrx(sweepAddress, sweepAmount, wallet.address);

                    // Sign with both signers
                    let signedTx = await tronWeb.trx.sign(tx, wallet.signerOne.privateKey, undefined, wallet.signerOne.address);
                    // signedTx = await tronWeb.trx.multiSign(signedTx, wallet.signerTwo.privateKey, wallet.signerTwo.address);

                    // Broadcast transaction
                    const sweepResult = await tronWeb.trx.sendRawTransaction(signedTx);
                    if (sweepResult.result) {
                        // console.log(`Sweep SUCCESS: ${tronWeb.fromSun(sweepAmount)} TRX from ${wallet.address} to ${sweepAddress} | TX: ${sweepResult.txid}`);
                        await SweepLog.create({
                            from: wallet.address,
                            to: sweepAddress,
                            amount: tronWeb.fromSun(sweepAmount),
                            txid: sweepResult.txid,
                            status: 'SUCCESS'
                        });
                    } else {
                        // console.error(`Sweep FAILED: ${tronWeb.fromSun(sweepAmount)} TRX from ${wallet.address} to ${sweepAddress}`, sweepResult);
                        await SweepLog.create({
                            from: wallet.address,
                            to: sweepAddress,
                            amount: tronWeb.fromSun(sweepAmount),
                            status: 'FAILED',
                            error: JSON.stringify(sweepResult)
                        });
                    }
                } catch (sweepErr) {
                    console.error(`Sweep error for wallet ${wallet.address}:`, sweepErr);
                }
            }
        }
    } catch (err) {
        console.error('Polling error:', err);
    }

    console.log('Wallet sweep job completed. Waiting 15 seconds before next run...');
    setTimeout(sweepWallets, 15000); // Wait 15 seconds after finishing
}



app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));

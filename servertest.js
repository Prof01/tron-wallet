// tron-multisig-api/index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const TronWeb = require('tronweb');
const bip39 = require('bip39');
const crypto = require('crypto');
const cron = require('node-cron');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/User');

const app = express();
app.use(express.json());

// Use environment variables in your code
const tronWeb = new TronWeb({
    fullHost: process.env.TRON_FULLHOST,
    headers: {
        'TRON-PRO-API-KEY': process.env.TRON_API_KEY
    },
    privateKey: process.env.TRON_PRIVATE_KEY // Optional, if you need to sign transactions
});

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'));

const Wallet = require('./models/Wallet');
const SingleWallet = require('./models/SingleWallet');
const TransactionLog = require('./models/TransactionLog');
const Approval = require('./models/Approval');

const generateAccountWithPassphrase = require('./functions/generateAccountWithPassphrase');

const DEFAULT_PASSPHRASES = [
    crypto.randomBytes(8).toString('hex'),
    crypto.randomBytes(8).toString('hex')
];


const walletRoutes = require('./routes/walletRoutes')(Wallet, tronWeb, bip39, generateAccountWithPassphrase, DEFAULT_PASSPHRASES);
const singleWalletRoutes = require('./routes/singleWalletRoutes')(SingleWallet, tronWeb, bip39);
const withdrawRoutes = require('./routes/withdrawRoutes')(Wallet, Approval, tronWeb);
const userRoutes = require('./routes/userRoutes')(User);
const authRoutes = require('./routes/authRoutes');


app.use('/api/wallets', walletRoutes);
app.use('/api/single-wallets', singleWalletRoutes);
app.use('/api/withdraw', withdrawRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);

app.use(session({
    secret: process.env.SECRET_KEY || 'your_secret_key_here',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

cron.schedule('* * * * *', async () => {
    try {
        const wallets = await Wallet.find({});
        for (const wallet of wallets) {
            const trxTxs = await tronWeb.trx.getTransactionsRelated(wallet.address, 'to');
            for (const tx of trxTxs) {
                const hash = tx.txID;
                const exists = await TransactionLog.findOne({ hash });
                if (!exists) {
                    const value = tx.raw_data.contract[0].parameter.value;
                    await TransactionLog.create({
                        address: wallet.address,
                        type: 'TRX',
                        hash,
                        from: tronWeb.address.fromHex(value.owner_address),
                        to: tronWeb.address.fromHex(value.to_address),
                        amount: tronWeb.fromSun(value.amount),
                        timestamp: new Date(tx.block_timestamp)
                    });
                }
            }

            const trcContracts = await Approval.find({ walletId: wallet._id, type: 'TRC20' }).distinct('tokenContractAddress');
            for (const contractAddr of trcContracts) {
                const contract = await tronWeb.contract().at(contractAddr);
                const events = await contract.getPastEvents('Transfer', { fromBlock: 0 });
                for (const e of events) {
                    if (tronWeb.address.fromHex(e.result.to) === wallet.address) {
                        const exists = await TransactionLog.findOne({ hash: e.transaction });
                        if (!exists) {
                            await TransactionLog.create({
                                address: wallet.address,
                                type: 'TRC20',
                                hash: e.transaction,
                                from: tronWeb.address.fromHex(e.result.from),
                                to: tronWeb.address.fromHex(e.result.to),
                                amount: tronWeb.fromSun(e.result.value),
                                tokenContract: contractAddr,
                                timestamp: new Date()
                            });
                        }
                    }
                }
            }
        }
        console.log('Polled transactions');
    } catch (err) {
        console.error('Polling error:', err);
    }
});

app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));

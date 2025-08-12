const express = require('express');
const ensureAuthenticated = require('../config/auth');
const router = express.Router();

module.exports = (Wallet, Approval, tronWeb) => {
    // TRX withdrawal with multisig
    router.post('/trx', ensureAuthenticated, async (req, res) => {
        const { walletId, toAddress, amount } = req.body;
        if (!walletId || !toAddress || !amount)
            return res.status(400).json({ msg: 'Missing required fields' });

        try {
            const wallet = await Wallet.findById(walletId);
            if (!wallet) return res.status(404).json({ msg: 'Wallet not found' });

            const { signerOne, signerTwo } = wallet;

            // Check if already approved
            let approval = await Approval.findOne({ walletId, type: 'TRX', toAddress, amount, executed: false });

            if (!approval) {
                const tx = await tronWeb.transactionBuilder.sendTrx(toAddress, tronWeb.toSun(amount), wallet.address);
                // const signedOnce = await tronWeb.trx.sign(tx, signerOne.privateKey, undefined, wallet.signerOne.address);
                // const fullySigned = await tronWeb.trx.multiSign(signedOnce, signerTwo.privateKey, wallet.address);

                    // Sign with both signers
                    let signedTx = await tronWeb.trx.sign(tx, wallet.signerOne.privateKey, undefined, wallet.signerOne.address);
                const broadcast = await tronWeb.trx.sendRawTransaction(signedTx);
               
                { broadcast?.transaction?.visible && await Approval.create({
                    walletId,
                    type: 'TRX',
                    toAddress,
                    amount,
                    approvals: ['signerOne', 'signerTwo'],
                    signatures: fullySigned.signature,
                    rawTx: fullySigned,
                    executed: true
                });}

                return res.status(200).json({ msg: 'TRX sent with multisig', broadcast });
            }

            return res.status(400).json({ msg: 'Transaction already pending or executed' });

        } catch (err) {
            console.error(err);
            res.status(500).json({ msg: 'TRX withdrawal failed' });
        }
    });

    // TRC20 withdrawal with multisig
    router.post('/trc20', ensureAuthenticated, async (req, res) => {
        const { walletId, toAddress, amount, tokenContractAddress } = req.body;
        if (!walletId || !toAddress || !amount || !tokenContractAddress)
            return res.status(400).json({ msg: 'Missing required fields' });

        try {
            const wallet = await Wallet.findById(walletId);
            if (!wallet) return res.status(404).json({ msg: 'Wallet not found' });

            const { signerOne, signerTwo } = wallet;

            let approval = await Approval.findOne({ walletId, type: 'TRC20', toAddress, amount, tokenContractAddress, executed: false });

            if (!approval) {
                const contract = await tronWeb.contract().at(tokenContractAddress);
                const tx = await contract.methods.transfer(toAddress, tronWeb.toSun(amount)).send({
                    feeLimit: 100_000_000,
                    callValue: 0,
                    shouldPollResponse: false
                }, {
                    from: wallet.address,
                    permissionId: 2,
                    rawResponse: true,
                    onlyRaw: true
                });

                // const signedOnce = await tronWeb.trx.sign(tx, signerOne.privateKey, undefined, wallet.address);
                // const fullySigned = await tronWeb.trx.multiSign(signedOnce, signerTwo.privateKey, wallet.address);
                
                let signedTx = await tronWeb.trx.sign(tx, wallet.signerOne.privateKey, undefined, wallet.signerOne.address);
              
                const broadcast = await tronWeb.trx.sendRawTransaction(signedTx);

                { broadcast?.transaction?.visible && await Approval.create({
                    walletId,
                    type: 'TRC20',
                    toAddress,
                    amount,
                    tokenContractAddress,
                    approvals: ['signerOne', 'signerTwo'],
                    signatures: fullySigned.signature,
                    rawTx: fullySigned,
                    executed: true
                });
                }

                return res.status(200).json({ msg: 'TRC20 sent with multisig', broadcast });
            }

            return res.status(400).json({ msg: 'Transaction already pending or executed' });

        } catch (err) {
            console.error(err);
            res.status(500).json({ msg: 'TRC20 withdrawal failed' });
        }
    });

    return router;
};

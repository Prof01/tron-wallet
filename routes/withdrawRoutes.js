const express = require('express');
const router = express.Router();

module.exports = (Wallet, Approval, tronWeb) => {
    // TRX withdrawal with multisig
    router.post('/trx', async (req, res) => {
        const { walletId, toAddress, amount, signerPassphrase } = req.body;
        if (!walletId || !toAddress || !amount || !signerPassphrase)
            return res.status(400).json({ msg: 'Missing required fields' });

        try {
            const wallet = await Wallet.findById(walletId);
            const signer = [wallet.signerOne, wallet.signerTwo].find(s => s.passphrase === signerPassphrase);
            if (!signer) return res.status(403).json({ msg: 'Invalid signer' });

            let approval = await Approval.findOne({ walletId, type: 'TRX', toAddress, amount, executed: false });

            // If no approval, create transaction and store first signature
            if (!approval) {
                const tx = await tronWeb.transactionBuilder.sendTrx(toAddress, tronWeb.toSun(amount), wallet.address);
                const signedTx = await tronWeb.trx.sign(tx, signer.privateKey, undefined, wallet.address);
                approval = await Approval.create({
                    walletId,
                    type: 'TRX',
                    toAddress,
                    amount,
                    approvals: [signerPassphrase],
                    signatures: [signedTx.signature[0]],
                    rawTx: signedTx // Store the signedTx object for further signing
                });
                return res.status(200).json({ msg: 'First signature collected. Awaiting second signature.' });
            }

            // If already signed by this signer, do not allow duplicate
            if (approval.approvals.includes(signerPassphrase)) {
                return res.status(400).json({ msg: 'This signer has already approved.' });
            }

            // Add second signature
            let rawTx = approval.rawTx;
            // If rawTx is stringified, parse it
            if (typeof rawTx === 'string') rawTx = JSON.parse(rawTx);

            // Add the new signature
            const multiSignedTx = await tronWeb.trx.multiSign(rawTx, signer.privateKey, wallet.address);

            approval.approvals.push(signerPassphrase);
            approval.signatures.push(multiSignedTx.signature[multiSignedTx.signature.length - 1]);
            approval.rawTx = multiSignedTx;

            // If both signatures, broadcast
            if (approval.approvals.length >= 2 && !approval.executed) {
                const broadcast = await tronWeb.trx.sendRawTransaction(multiSignedTx);
                approval.executed = true;
                await approval.save();
                return res.status(200).json({ msg: 'TRX sent with multisig', broadcast });
            }

            await approval.save();
            res.status(200).json({ msg: 'Second signature collected. Awaiting broadcast.' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ msg: 'TRX withdrawal failed' });
        }
    });

    // TRC20 withdrawal with multisig
    router.post('/trc20', async (req, res) => {
        const { walletId, toAddress, amount, tokenContractAddress, signerPassphrase } = req.body;
        if (!walletId || !toAddress || !amount || !tokenContractAddress || !signerPassphrase)
            return res.status(400).json({ msg: 'Missing required fields' });

        try {
            const wallet = await Wallet.findById(walletId);
            const signer = [wallet.signerOne, wallet.signerTwo].find(s => s.passphrase === signerPassphrase);
            if (!signer) return res.status(403).json({ msg: 'Invalid signer' });

            let approval = await Approval.findOne({ walletId, type: 'TRC20', toAddress, amount, tokenContractAddress, executed: false });

            // If no approval, create transaction and store first signature
            if (!approval) {
                const contract = await tronWeb.contract().at(tokenContractAddress);
                const tx = await contract.methods.transfer(toAddress, tronWeb.toSun(amount)).send({
                    feeLimit: 100_000_000,
                    callValue: 0,
                    shouldPollResponse: false
                }, { from: wallet.address, permissionId: 2, rawResponse: true, onlyRaw: true });

                const signedTx = await tronWeb.trx.sign(tx, signer.privateKey, undefined, wallet.address);
                approval = await Approval.create({
                    walletId,
                    type: 'TRC20',
                    toAddress,
                    amount,
                    tokenContractAddress,
                    approvals: [signerPassphrase],
                    signatures: [signedTx.signature[0]],
                    rawTx: signedTx
                });
                return res.status(200).json({ msg: 'First signature collected. Awaiting second signature.' });
            }

            // If already signed by this signer, do not allow duplicate
            if (approval.approvals.includes(signerPassphrase)) {
                return res.status(400).json({ msg: 'This signer has already approved.' });
            }

            // Add second signature
            let rawTx = approval.rawTx;
            if (typeof rawTx === 'string') rawTx = JSON.parse(rawTx);

            const multiSignedTx = await tronWeb.trx.multiSign(rawTx, signer.privateKey, wallet.address);

            approval.approvals.push(signerPassphrase);
            approval.signatures.push(multiSignedTx.signature[multiSignedTx.signature.length - 1]);
            approval.rawTx = multiSignedTx;

            // If both signatures, broadcast
            if (approval.approvals.length >= 2 && !approval.executed) {
                const broadcast = await tronWeb.trx.sendRawTransaction(multiSignedTx);
                approval.executed = true;
                await approval.save();
                return res.status(200).json({ msg: 'TRC20 sent with multisig', broadcast });
            }

            await approval.save();
            res.status(200).json({ msg: 'Second signature collected. Awaiting broadcast.' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ msg: 'TRC20 withdrawal failed' });
        }
    });

    return router;
};
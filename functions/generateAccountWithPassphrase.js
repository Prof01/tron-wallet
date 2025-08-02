const bip39 = require('bip39');

const generateAccountWithPassphrase = async (tronWeb, passphrase) => {
    const mnemonic = await bip39.generateMnemonic();
    const account = await tronWeb.createAccount();
    return {
        mnemonic,
        ...account,
        passphrase
    };
};

module.exports = generateAccountWithPassphrase;
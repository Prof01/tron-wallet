const bip39 = require('bip39');
const hdkey = require('hdkey');

const generateAccountWithPassphrase = async (tronWeb, mnemonic) => {
    if (!mnemonic) {
        mnemonic = bip39.generateMnemonic();
    }
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = hdkey.fromMasterSeed(seed);
    const child = root.derive("m/44'/195'/0'/0/0"); // Tron uses BIP44 path 195
    const privateKey = child.privateKey.toString('hex');
    const address = tronWeb.address.fromPrivateKey(privateKey);

    return {
        mnemonic,
        address,
        publicKey: child.publicKey.toString('hex'),
        privateKey
    };
};

module.exports = generateAccountWithPassphrase;
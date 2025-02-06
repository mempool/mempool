/* eslint-disable no-inline-comments */

/**
 * Module dependencies.
 */

const _ = require('lodash');

/**
 * Export available rpc methods.
 */

module.exports = {
  abandonTransaction: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.12.0'
  },
  abortRescan: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.15.0'
  },
  addMultiSigAddress: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.1.0'
  },
  addNode: {
    category: 'network',
    version: '>=0.8.0'
  },
  addWitnessAddress: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.13.0 <0.18.0'
  },
  analyzePsbt: {
    category: 'rawtransactions',
    version: '>=0.18.0'
  },
  backupWallet: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.3.12'
  },
  bumpFee: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.14.0'
  },
  clearBanned: {
    category: 'network',
    version: '>=0.12.0'
  },
  combinePsbt: {
    category: 'rawtransactions',
    version: '>=0.17.0'
  },
  combineRawTransaction: {
    category: 'rawtransactions',
    version: '>=0.15.0'
  },
  convertToPsbt: {
    category: 'rawtransactions',
    version: '>=0.17.0'
  },
  createMultiSig: {
    category: 'util',
    version: '>=0.1.0'
  },
  createPsbt: {
    category: 'rawtransactions',
    version: '>=0.17.0'
  },
  createRawTransaction: {
    category: 'rawtransactions',
    version: '>=0.7.0'
  },
  createWallet: {
    category: 'wallet',
    version: '>=0.17.0'
  },
  createWalletDescriptor: {
    category: 'wallet',
    features: {
      multiwallet: '>=28.0.0'
    },
    version: '>=28.0.0'
  },
  createWitnessAddress: {
    category: 'wallet',
    version: '=0.13.0'
  },
  decodePsbt: {
    category: 'rawtransactions',
    version: '>=0.17.0'
  },
  decodeRawTransaction: {
    category: 'rawtransactions',
    version: '>=0.7.0'
  },
  decodeScript: {
    category: 'rawtransactions',
    version: '>=0.9.0'
  },
  deriveAddresses: {
    category: 'util',
    version: '>=0.18.0'
  },
  descriptorProcessPsbt: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.26.0'
    },
    version: '>=26.0.0'
  },
  disconnectNode: {
    category: 'network',
    version: '>=0.12.0'
  },
  dumpPrivKey: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    obfuscate: {
      response: () => '******'
    },
    version: '>=0.6.0'
  },
  dumpTxOutset: {
    category: 'wallet',
    version: '>=0.20.0'
  },
  dumpWallet: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.9.0'
  },
  encryptWallet: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    obfuscate: {
      request: {
        default: params => _.set([...params], '[0]', '******'),
        named: params => _.set(params, 'passphrase', '******')
      }
    },
    version: '>=0.1.0'
  },
  enumerateSigners: {
    category: 'signer',
    version: '>=0.24.0'
  },
  estimateFee: {
    category: 'util',
    version: '>=0.10.0'
  },
  estimatePriority: {
    category: 'util',
    version: '>=0.10.0 <0.15.0'
  },
  estimateSmartFee: {
    category: 'util',
    version: '>=0.12.0'
  },
  estimateSmartPriority: {
    category: 'util',
    version: '>=0.12.0 <0.15.0'
  },
  finalizePsbt: {
    category: 'rawtransactions',
    version: '>=0.17.0'
  },
  fundRawTransaction: {
    category: 'rawtransactions',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.12.0'
  },
  generate: {
    category: 'generating',
    features: {
      multiwallet: '>=0.15.0 <0.19.0'
    },
    version: '>=0.11.0 <0.19.0'
  },
  generateToAddress: {
    category: 'generating',
    version: '>=0.13.0'
  },
  generateToDescriptor: {
    category: 'generating',
    version: '>=0.20.0'
  },
  getAccount: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0 <0.18.0'
    },
    version: '>=0.1.0 <0.18.0'
  },
  getAccountAddress: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0 <0.18.0'
    },
    version: '>=0.3.18 <0.18.0'
  },
  getAddedNodeInfo: {
    category: 'network',
    version: '>=0.8.0'
  },
  getAddrManInfo: {
    category: 'network',
    version: '>=26.0.0'
  },
  getAddressInfo: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.17.0'
    },
    version: '>=0.17.0'
  },
  getAddressesByAccount: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0 <0.18.0'
    },
    version: '>=0.1.0 <0.18.0'
  },
  getAddressesByLabel: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.17.0'
    },
    version: '>=0.17.0'
  },
  getBalance: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.3.18'
  },
  getBalances: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.19.0'
    },
    version: '>=0.19.0'
  },
  getBestBlockHash: {
    category: 'blockchain',
    version: '>=0.9.0'
  },
  getBlock: {
    category: 'blockchain',
    version: '>=0.6.0'
  },
  getBlockCount: {
    category: 'blockchain',
    version: '>=0.1.0'
  },
  getBlockFilter: {
    category: 'blockchain',
    version: '>=0.19.0'
  },
  getBlockFromPeer: {
    category: 'blockchain',
    version: '>=24.0.0'
  },
  getBlockHash: {
    category: 'blockchain',
    version: '>=0.6.0'
  },
  getBlockHeader: {
    category: 'blockchain',
    version: '>=0.12.0'
  },
  getBlockStats: {
    category: 'blockchain',
    version: '>=0.17.0'
  },
  getBlockTemplate: {
    category: 'mining',
    version: '>=0.7.0'
  },
  getBlockchainInfo: {
    category: 'blockchain',
    version: '>=0.9.2'
  },
  getChainStates: {
    category: 'blockchain',
    version: '>=26.0.0'
  },
  getChainTips: {
    category: 'blockchain',
    version: '>=0.10.0'
  },
  getChainTxStats: {
    category: 'blockchain',
    version: '>=0.15.0'
  },
  getConnectionCount: {
    category: 'network',
    version: '>=0.1.0'
  },
  getDeploymentInfo: {
    category: 'blockchain',
    version: '>=0.23.0'
  },
  getDescriptorInfo: {
    category: 'util',
    version: '>=0.18.0'
  },
  getDifficulty: {
    category: 'blockchain',
    version: '>=0.1.0'
  },
  getGenerate: {
    category: 'generating',
    version: '<0.13.0'
  },
  getHashesPerSec: {
    category: 'blockchain',
    version: '<0.10.0'
  },
  getHdKeys: {
    category: 'wallet',
    features: {
      multiwallet: '>=28.0.0'
    },
    version: '>=28.0.0'
  },
  getIndexInfo: {
    category: 'util',
    version: '>=0.21.0'
  },
  getInfo: {
    category: 'control',
    version: '>=0.1.0 <0.16.0'
  },
  getMemoryInfo: {
    category: 'control',
    version: '>=0.14.0'
  },
  getMempoolAncestors: {
    category: 'blockchain',
    version: '>=0.13.0'
  },
  getMempoolDescendants: {
    category: 'blockchain',
    version: '>=0.13.0'
  },
  getMempoolEntry: {
    category: 'blockchain',
    version: '>=0.13.0'
  },
  getMempoolInfo: {
    category: 'blockchain',
    version: '>=0.10.0'
  },
  getMiningInfo: {
    category: 'mining',
    version: '>=0.6.0'
  },
  getNetTotals: {
    category: 'network',
    version: '>=0.1.0'
  },
  getNetworkHashPs: {
    category: 'mining',
    version: '>=0.9.0'
  },
  getNetworkInfo: {
    category: 'network',
    version: '>=0.9.2'
  },
  getNewAddress: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.1.0'
  },
  getNodeAddresses: {
    category: 'network',
    version: '>=0.18.0'
  },
  getPeerInfo: {
    category: 'network',
    version: '>=0.7.0'
  },
  getPrioritisedTransactions: {
    category: 'mempool',
    version: '>=26.0.0'
  },
  getRawChangeAddress: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.9.0'
  },
  getRawMempool: {
    category: 'blockchain',
    version: '>=0.7.0'
  },
  getRawTransaction: {
    category: 'rawtransactions',
    version: '>=0.7.0'
  },
  getReceivedByAccount: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0 <0.18.0'
    },
    version: '>=0.1.0 <0.18.0'
  },
  getReceivedByAddress: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.1.0'
  },
  getReceivedByLabel: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.17.0'
    },
    version: '>=0.17.0'
  },
  getRpcInfo: {
    category: 'control',
    version: '>=0.18.0'
  },
  getTransaction: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.1.0'
  },
  getTxOut: {
    category: 'blockchain',
    version: '>=0.7.0'
  },
  getTxOutProof: {
    category: 'blockchain',
    version: '>=0.11.0'
  },
  getTxOutSetInfo: {
    category: 'blockchain',
    version: '>=0.7.0'
  },
  getTxSpendingPrevOut: {
    category: 'blockchain',
    version: '>=24.0.0'
  },
  getUnconfirmedBalance: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.9.0'
  },
  getWalletInfo: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.9.2'
  },
  getWork: {
    category: 'blockchain',
    version: '<0.10.0'
  },
  getZmqNotifications: {
    category: 'control',
    version: '>=0.17.0'
  },
  help: {
    category: 'control',
    version: '>=0.1.0'
  },
  importAddress: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.10.0'
  },
  importDescriptors: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.21.0'
    },
    version: '>=0.21.0'
  },
  importMempool: {
    category: 'mempool',
    version: '>=26.0.0'
  },
  importMulti: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    obfuscate: {
      request: {
        default: params => _.set(params, '[0]', _.map(params[0], request => _.set(request, 'keys', _.map(request.keys, () => '******')))),
        named: params => _.set(params, 'requests', _.map(params.requests, request => _.set(request, 'keys', _.map(request.keys, () => '******'))))
      }
    },
    version: '>=0.14.0'
  },
  importPrivKey: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    obfuscate: {
      request: {
        default: () => ['******'],
        named: params => _.set(params, 'privkey', '******')
      }
    },
    version: '>=0.6.0'
  },
  importPrunedFunds: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.13.0'
  },
  importPubKey: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.12.0'
  },
  importWallet: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.9.0'
  },
  joinPsbts: {
    category: 'rawtransactions',
    version: '>=0.18.0'
  },
  keypoolRefill: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.1.0'
  },
  listAccounts: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0 <0.18.0'
    },
    version: '>=0.1.0 <0.18.0'
  },
  listAddressGroupings: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.7.0'
  },
  listBanned: {
    category: 'network',
    version: '>=0.12.0'
  },
  listDescriptors: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.22.0'
    },
    version: '>=0.22.0'
  },
  listLabels: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.17.0'
    },
    version: '>=0.17.0'
  },
  listLockUnspent: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.8.0'
  },
  listReceivedByAccount: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0 <0.18.0'
    },
    version: '>=0.1.0 <0.18.0'
  },
  listReceivedByAddress: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.1.0'
  },
  listReceivedByLabel: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.17.0'
    },
    version: '>=0.17.0'
  },
  listSinceBlock: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.5.0'
  },
  listTransactions: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.3.18'
  },
  listUnspent: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.7.0'
  },
  listWalletDir: {
    category: 'wallet',
    version: '>=0.18.0'
  },
  listWallets: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.15.0'
  },
  loadTxOutSet: {
    category: 'blockchain',
    version: '>=26.0.0'
  },
  loadWallet: {
    category: 'wallet',
    version: '>=0.17.0'
  },
  lockUnspent: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.8.0'
  },
  logging: {
    version: '>=0.17.0'
  },
  migrateWallet: {
    category: 'wallet',
    features: {
      multiwallet: '>=24.0.0'
    },
    version: '>=24.0.0'
  },
  move: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.3.18'
  },
  newKeyPool: {
    category: 'wallet',
    features: {
      multiwallet: '>=24.0.0'
    },
    version: '>=24.0.0'
  },
  ping: {
    category: 'network',
    version: '>=0.9.0'
  },
  preciousBlock: {
    category: 'blockchain',
    version: '>=0.14.0'
  },
  prioritiseTransaction: {
    category: 'mining',
    version: '>=0.10.0'
  },
  pruneBlockchain: {
    category: 'blockchain',
    version: '>=0.14.0'
  },
  psbtBumpFee: {
    category: 'wallet',
    features: {
      multiwallet: '>=24.0.0'
    },
    version: '>=24.0.0'
  },
  removePrunedFunds: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.13.0'
  },
  rescanBlockchain: {
    category: 'wallet',
    version: '>=0.16.0'
  },
  restoreWallet: {
    category: 'wallet',
    features: {
      multiwallet: '>=23.0.0'
    },
    version: '>=23.0.0'
  },
  saveMempool: {
    category: 'blockchain',
    version: '>=0.16.0'
  },
  scanBlocks: {
    category: 'blockchain',
    version: '>=25.0.0'
  },
  scanTxOutSet: {
    category: 'blockchain',
    version: '=>0.17.0'
  },
  send: {
    category: 'wallet',
    features: {
      multiwallet: '>=24.0.0'
    },
    version: '>=24.0.0'
  },
  sendAll: {
    category: 'wallet',
    features: {
      multiwallet: '>=24.0.0'
    },
    version: '>=24.0.0'
  },
  sendFrom: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.3.18'
  },
  sendMany: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.3.21'
  },
  sendRawTransaction: {
    category: 'rawtransactions',
    version: '>=0.7.0'
  },
  sendToAddress: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.1.0'
  },
  setAccount: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0 <0.18.0'
    },
    version: '>=0.1.0 <0.18.0'
  },
  setBan: {
    category: 'network',
    version: '>=0.12.0'
  },
  setGenerate: {
    category: 'generating',
    version: '<0.13.0'
  },
  setHdSeed: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.17.0'
    },
    obfuscate: {
      request: {
        default: params => _.set([...params], '[1]', '******'),
        named: params => _.set(params, 'seed', '******')
      }
    },
    version: '>=0.17.0'
  },
  setLabel: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.17.0'
    },
    version: '>=0.17.0'
  },
  setNetworkActive: {
    category: 'network',
    version: '>=0.14.0'
  },
  setTxFee: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.3.22'
  },
  setWalletFlag: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.19.0'
    },
    version: '>=0.19.0'
  },
  signMessage: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.5.0'
  },
  signMessageWithPrivKey: {
    category: 'util',
    obfuscate: {
      request: {
        default: params => _.set([...params], '[0]', '******'),
        named: params => _.set(params, 'privkey', '******')
      }
    },
    version: '>=0.13.0'
  },
  signRawTransaction: {
    category: 'rawtransactions',
    obfuscate: {
      request: {
        default: params => _.set([...params], '[2]', _.map(params[2], () => '******')),
        named: params => _.set(params, 'privkeys', _.map(params.privkeys || [], () => '******'))
      }
    },
    version: '>=0.7.0 <0.18.0'
  },
  signRawTransactionWithKey: {
    category: 'rawtransactions',
    obfuscate: {
      request: {
        default: params => _.set([...params], '[1]', _.map(params[1], () => '******')),
        named: params => _.set(params, 'privkeys', _.map(params.privkeys || [], () => '******'))
      }
    },
    version: '>=0.17.0'
  },
  signRawTransactionWithWallet: {
    category: 'rawtransactions',
    features: {
      multiwallet: '>=0.17.0'
    },
    version: '>=0.17.0'
  },
  simulateRawTransaction: {
    category: 'wallet',
    features: {
      multiwallet: '>=24.0.0'
    },
    version: '>=24.0.0'
  },
  stop: {
    category: 'control',
    version: '>=0.1.0'
  },
  submitBlock: {
    category: 'mining',
    version: '>=0.7.0'
  },
  submitHeader: {
    category: 'mining',
    version: '>=24.0.0'
  },
  submitPackage: {
    category: 'mempool',
    version: '>=26.0.0'
  },
  testMempoolAccept: {
    category: 'blockchain',
    version: '>=0.17.0'
  },
  unloadWallet: {
    category: 'wallet',
    version: '>=0.17.0'
  },
  upTime: {
    category: 'control',
    version: '>=0.15.0'
  },
  upgradeWallet: {
    category: 'wallet',
    features: {
      multiwallet: '>=24.0.0'
    },
    version: '>=24.0.0'
  },
  utxoUpdatePsbt: {
    category: 'rawtransactions',
    version: '>=0.18.0'
  },
  validateAddress: {
    category: 'util',
    version: '>=0.3.14'
  },
  verifyChain: {
    category: 'blockchain',
    version: '>=0.9.0'
  },
  verifyMessage: {
    category: 'util',
    version: '>=0.5.0'
  },
  verifyTxOutProof: {
    category: 'blockchain',
    version: '>0.11.0'
  },
  walletCreateFundedPsbt: {
    category: 'rawtransactions',
    features: {
      multiwallet: '>=0.17.0'
    },
    version: '>=0.17.0'
  },
  walletDisplayAddress: {
    category: 'wallet',
    features: {
      multiwallet: '>=24.0.0'
    },
    version: '>=24.0.0'
  },
  walletLock: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    version: '>=0.1.0'
  },
  walletPassphrase: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    obfuscate: {
      request: {
        default: params => _.set([...params], '[0]', '******'),
        named: params => _.set(params, 'passphrase', '******')
      }
    },
    version: '>=0.1.0'
  },
  walletPassphraseChange: {
    category: 'wallet',
    features: {
      multiwallet: '>=0.15.0'
    },
    obfuscate: {
      request: {
        default: params => _.set(_.set([...params], '[0]', '******'), '[1]', '******'),
        named: params => _.set(_.set(params, 'oldpassphrase', '******'), 'newpassphrase', '******')
      }
    },
    version: '>=0.1.0'
  },
  walletProcessPsbt: {
    category: 'rawtransactions',
    features: {
      multiwallet: '>=0.17.0'
    },
    version: '>=0.17.0'
  }
};

'use strict';
/**
 * Encode Pons V2 launchToken calldata. Does not send.
 * Usage: node ops/tge/encode-pons-v2-launch.cjs 0xPhantomEthPubkey
 */
const { Interface, keccak256, toUtf8Bytes } = require('ethers');
const { execFileSync } = require('child_process');

const V2 = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';
const RPC = process.env.RPC || 'https://rpc.mainnet.chain.robinhood.com';
const feeWallet = process.argv[2] || process.env.FEE_WALLET;
if (!/^0x[0-9a-fA-F]{40}$/.test(feeWallet || '')) {
  console.error('ASSERT_FAIL pass Phantom Ethereum pubkey: node encode-pons-v2-launch.cjs 0x…');
  process.exit(1);
}

const econ = execFileSync(
  'cast',
  ['call', V2, 'previewLaunchEconomics(uint256,address)(bytes32)', '0', '0x0000000000000000000000000000000000000000', '--rpc-url', RPC],
  { encoding: 'utf8' }
).trim();

const salt = process.env.SALT || keccak256(toUtf8Bytes(`helbreath.pons.v2.${Date.now()}.${feeWallet}`));
const pack = require('./pons-create-pack.json');

const iface = new Interface([
  {
    type: 'function',
    name: 'launchToken',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'logo', type: 'string' },
          { name: 'description', type: 'string' },
          {
            name: 'socials',
            type: 'tuple',
            components: [
              { name: 'twitter', type: 'string' },
              { name: 'telegram', type: 'string' },
              { name: 'discord', type: 'string' },
              { name: 'website', type: 'string' },
              { name: 'farcaster', type: 'string' },
            ],
          },
          { name: 'creatorFeeRecipient', type: 'address' },
          { name: 'creatorTaxBps', type: 'uint16' },
          { name: 'buybackEnabled', type: 'bool' },
          { name: 'expectedEconomics', type: 'bytes32' },
          { name: 'salt', type: 'bytes32' },
        ],
      },
      { name: 'launchConfigId', type: 'uint256' },
      { name: 'pairToken', type: 'address' },
    ],
  },
]);

const data = iface.encodeFunctionData('launchToken', [
  {
    name: pack.name,
    symbol: pack.symbol,
    logo: pack.logo,
    description: pack.description,
    socials: pack.socials,
    creatorFeeRecipient: feeWallet,
    creatorTaxBps: pack.creatorTaxBps,
    buybackEnabled: true,
    expectedEconomics: econ,
    salt,
  },
  0n,
  '0x0000000000000000000000000000000000000000',
]);

const out = {
  factory: V2,
  chainId: 4663,
  to: V2,
  value: '0x1C6BF52634000',
  valueEth: '0.0005',
  data,
  feeWallet,
  expectedEconomics: econ,
  salt,
  rpc: RPC,
  note: 'V2 launchFee must be exact 0.0005 ETH. $50 first buy is a later curve tx.',
};
console.log(JSON.stringify(out, null, 2));

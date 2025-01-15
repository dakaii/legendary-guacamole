import { createSolanaRpc, address } from '@solana/web3.js';

// const mainnetRpc = createSolanaRpc(mainnet('https://api.mainnet-beta.solana.com'));

// const devnetRpc = createSolanaRpc(devnet('https://api.devnet.solana.com'));

// https://github.com/anza-xyz/solana-web3.js

const rpcUrl = process.env.VITE_SOLANA_RPC_URL || 'http://localhost:8899';
const programId = process.env.VITE_SOLANA_PROGRAM_ID || 'BPrjbxBWnwyBjAvFWejSVCvTmppqHqN8mdfD1Rwy4Pcf';

const connection = createSolanaRpc(rpcUrl);
const programPublicKey = address(programId);

export { connection, programPublicKey };;
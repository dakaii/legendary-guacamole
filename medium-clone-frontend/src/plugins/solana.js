// src/plugins/solana.js
import { provide, inject } from 'vue';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import {
    WalletAdapterNetwork,
} from '@solana/wallet-adapter-base';
import {
    PhantomWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { AnchorProvider, Program, web3 } from '@project-serum/anchor';
import idl from '../idl/medium_clone.json';

const { SystemProgram } = web3;

export const SolanaSymbol = Symbol('solana');

export default {
    install: (app) => {
        const network = WalletAdapterNetwork.Devnet;
        const endpoint = clusterApiUrl(network);
        const connection = new Connection(endpoint);

        const wallets = [new PhantomWalletAdapter()];

        const provider = new AnchorProvider(
            connection,
            wallets[0],
            AnchorProvider.defaultOptions()
        );

        const programID = new web3.PublicKey(idl.metadata.address);
        const program = new Program(idl, programID, provider);

        app.provide(SolanaSymbol, {
            connection,
            provider,
            program,
            SystemProgram,
        });
    },
};

export const useSolana = () => {
    return inject(SolanaSymbol);
};

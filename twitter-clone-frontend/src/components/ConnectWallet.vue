<template>
    <div>
        <button v-if="!wallet.connected" @click="connect">Connect Wallet</button>
        <div v-else>
            <span>{{ wallet.publicKey.toString() }}</span>
            <button @click="disconnect">Disconnect</button>
        </div>
    </div>
</template>

<script>
import { ref } from 'vue';
import { useSolana } from '../plugins/solana';

export default {
    setup() {
        const solana = useSolana();
        const wallet = ref(solana.provider.wallet);

        const connect = async () => {
            await solana.provider.wallet.connect();
        };

        const disconnect = async () => {
            await solana.provider.wallet.disconnect();
        };

        return {
            wallet,
            connect,
            disconnect,
        };
    },
};
</script>
<template>
    <div>
        <h2>Create New Post</h2>
        <form @submit.prevent="createPost">
            <div>
                <label>Title:</label>
                <input v-model="title" required />
            </div>
            <div>
                <label>Content:</label>
                <textarea v-model="content" required></textarea>
            </div>
            <button type="submit">Submit</button>
        </form>
    </div>
</template>

<script>
import { ref } from 'vue';
import { useSolana } from '../plugins/solana';

export default {
    setup() {
        const solana = useSolana();
        const title = ref('');
        const content = ref('');

        const createPost = async () => {
            try {
                const tx = await solana.program.rpc.createPost(title.value, content.value, {
                    accounts: {
                        post: solana.program.provider.wallet.publicKey, // Adjust as per your program
                        author: solana.provider.wallet.publicKey,
                        systemProgram: solana.SystemProgram.programId,
                    },
                });
                console.log("Transaction successful:", tx);
            } catch (err) {
                console.error("Transaction failed:", err);
            }
        };

        return {
            title,
            content,
            createPost,
        };
    },
};
</script>
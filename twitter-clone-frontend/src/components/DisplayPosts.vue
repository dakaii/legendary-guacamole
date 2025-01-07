<template>
    <div>
        <h2>Blog Posts</h2>
        <div v-for="post in posts" :key="post.publicKey">
            <h3>{{ post.title }}</h3>
            <p>{{ post.content }}</p>
            <p><strong>Author:</strong> {{ post.author }}</p>
            <p><strong>Created At:</strong> {{ post.createdAt }}</p>
            <hr />
        </div>
    </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useSolana } from '../plugins/solana';

export default {
    setup() {
        const solana = useSolana();
        const posts = ref([]);

        const fetchPosts = async () => {
            try {
                const accounts = await solana.program.account.post.all();
                posts.value = accounts.map(account => ({
                    publicKey: account.publicKey.toString(),
                    ...account.account,
                }));
            } catch (err) {
                console.error("Failed to fetch posts:", err);
            }
        };

        onMounted(() => {
            fetchPosts();
        });

        return {
            posts,
        };
    },
};
</script>
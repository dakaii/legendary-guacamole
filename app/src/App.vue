<template>
  <div>
    <h1>Solana Twitter Clone</h1>
    <p>Balance: {{ balance !== null ? `${balance} SOL` : "Loading..." }}</p>
    <ul>
      <li v-for="post in posts" :key="post.publicKey.toString()">
        <h2>{{ post.account.title }}</h2>
        <p>{{ post.account.content }}</p>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from "vue";
import { connection, solnanaAddress } from "./solana";

export default defineComponent({
  setup() {
    const balance = ref<number | null>(null);
    const posts = ref<any[]>([]);

    // Fetch the balance of a Solana account
    const fetchBalance = async () => {
      const { value: lamports } = await connection.getBalance(solnanaAddress).send();
      console.log(balance)
      balance.value = Number(BigInt(lamports)) / 10 ** 9;
    };

    // Fetch posts from the Solana program
    const fetchPosts = async () => {
      // const posts = await program.account.post.all();
      // posts.value = posts;
    };

    onMounted(() => {
      fetchBalance();
      fetchPosts();
    });

    return {
      balance,
      posts,
    };
  },
});
</script>
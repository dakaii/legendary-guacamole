<template>
  <div id="app">
    <h1>Twitter Clone</h1>
    <ConnectWallet />
    <CreatePost />
    <DisplayPosts />
  </div>
</template>

<script>
import ConnectWallet from './components/ConnectWallet.vue';
import CreatePost from './components/CreatePost.vue';
import DisplayPosts from './components/DisplayPosts.vue';

export default {
  components: {
    ConnectWallet,
    CreatePost,
    DisplayPosts,
  },
};
</script>

// tests/medium-clone.ts

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, setProvider } from "@coral-xyz/anchor";
import { MediumClone } from "../target/types/medium_clone";
import { assert } from "chai";
import { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

async function createPost(title: string, content: string, id: number, author: anchor.Wallet, program: Program<MediumClone>): Promise<PublicKey> {
  const postId = new anchor.BN(id); // Example post_id, replace with your logic

  await program.methods.createPost(title, content, postId)
    .accounts({
      author: author.publicKey,
    })
    .rpc();

  const [postPda, bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("post"),
      author.publicKey.toBuffer(),
      postId.toArrayLike(Buffer, "le", 8)
    ],
    program.programId
  );

  return postPda;
}

describe("medium-clone", () => {
  // Configure the client to use the local cluster.
  const provider = AnchorProvider.env();
  setProvider(provider);

  const program = anchor.workspace.MediumClone as Program<MediumClone>;
  const author = provider.wallet as anchor.Wallet;

  // Variables to store PDAs and data across tests
  const postTitle = "My First Post";
  const postContent = "This is the content of my first post.";

  const postId = new anchor.BN(1); // Starting post_id

  const commentContent = "Great post!";

  it("Creates a new post!", async () => {
    // Derive the PDA for the post
    // Send the transaction to create a post
    const tx = await program.methods.createPost(postTitle, postContent, postId)
      .accounts({
        author: author.publicKey
      })
      .rpc();

    console.log("CreatePost transaction signature", tx);

    // Fetch the post account
    const postsPdaAndBump = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from('post'),
        author.publicKey.toBuffer(),
        postId.toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const postsPda = postsPdaAndBump[0];
    const dataFromPda = await program.account.post.fetch(postsPda);
    // Assertions
    assert.ok(dataFromPda.author.equals(author.publicKey), "Author mismatch");
    assert.equal(dataFromPda.postId.toNumber(), postId.toNumber(), "Post ID mismatch");
    assert.equal(dataFromPda.title, postTitle, "Title mismatch");
    assert.equal(dataFromPda.content, postContent, "Content mismatch");
    assert.equal(dataFromPda.commentCount, 0, "Initial comment count should be 0");
  });

  it("Updates the post's title and content!", async () => {
    const newTitle = "My Updated Post";
    const newContent = "This is the updated content of my post.";
    const postPda = await createPost(postTitle, postContent, 2, author, program);

    // Send the transaction to update the post
    const tx = await program.methods.updatePost(newTitle, newContent)
      .accounts({
        post: postPda,
        author: author.publicKey,
      })
      .rpc();

    console.log("UpdatePost transaction signature", tx);

    const dataFromPda = await program.account.post.fetch(postPda);

    // Assertions
    assert.equal(dataFromPda.title, newTitle, "Title was not updated correctly");
    assert.equal(dataFromPda.content, newContent, "Content was not updated correctly");
    assert.isAtLeast(dataFromPda.updatedAt.toNumber(), dataFromPda.createdAt.toNumber(), "updated_at timestamp should be >= created_at");
  });

  // it("Adds a comment to the post!", async () => {
  //   // Fetch the current comment count
  //   const postAccountBefore = await getPostAccount(postPda);
  //   const currentCommentCount = postAccountBefore.commentCount;

  //   // Derive the PDA for the comment
  //   const [cPda, cBump] = await findCommentPda(program.programId, postPda, currentCommentCount);
  //   commentPda = cPda;
  //   commentBump = cBump;

  //   // Send the transaction to add a comment
  //   const tx = await program.methods.addComment(commentContent)
  //     .accounts({
  //       author: author.publicKey,
  //     })
  //     .rpc();

  //   console.log("AddComment transaction signature", tx);

  //   // Fetch the comment account
  //   const commentAccount = await getCommentAccount(commentPda);

  //   // Assertions for comment
  //   assert.ok(commentAccount.author.equals(author.publicKey), "Comment author mismatch");
  //   assert.equal(commentAccount.content, commentContent, "Comment content mismatch");

  //   // Fetch the post account after adding comment
  //   const postAccountAfter = await getPostAccount(postPda);
  //   assert.equal(postAccountAfter.commentCount, currentCommentCount + 1, "Comment count did not increment");
  // });

  it("Deletes the post!", async () => {
    const postPda = await createPost('Test Post', 'Test Content', 3, author, program);
    // Send the transaction to delete the post
    const tx = await program.methods.deletePost()
      .accounts({
        post: postPda,
        author: author.publicKey,
      })
      .rpc();

    console.log("DeletePost transaction signature", tx);

    // Attempt to fetch the post account, expecting it to fail
    try {
      await program.account.post.fetch(postPda);
      assert.fail("Post account should be deleted");
    } catch (err: any) {
      assert.ok(err.message.includes("Account does not exist"), "Unexpected error message");
    }
  });

  it("Prevents unauthorized updates to the post!", async () => {
    const postPda = await createPost('Test Post', 'Test Content', 4, author, program);
    // Create a new keypair to simulate another user
    const otherUser = Keypair.generate();

    // Airdrop SOL to the new user for transaction fees
    const airdropSignature = await provider.connection.requestAirdrop(otherUser.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(airdropSignature, "confirmed");

    // Create a wallet instance for the other user
    const otherUserWallet = new anchor.Wallet(otherUser);

    // Attempt to update the post using another user
    try {
      const a = await program.methods.updatePost("Hacked Title", "Hacked Content")
        .accounts({
          post: postPda,
          author: otherUserWallet.publicKey,
        })
        .signers([otherUserWallet.payer])
        .rpc();
      assert.fail("Unauthorized user was able to update the post");
    } catch (err: any) {
      // TODO - Check for the correct error message
      // assert.ok(err.message.includes("has_one constraint was not satisfied"), "Unexpected error message");
      assert.ok(err.message.includes("A seeds constraint was violated"), "Unexpected error message");
    }
  });

  // it("Creates a post with maximum title and content lengths!", async () => {
  //   const maxTitle = "T".repeat(100); // 100 characters
  //   const maxContent = "C".repeat(1000); // 1000 characters
  //   const maxPostId = new anchor.BN(2); // Next post_id

  //   // Derive PDA for the max post
  //   const [maxPostPda, maxPostBump] = await findPostPda(program.programId, author.publicKey, maxPostId.toNumber());

  //   // Send the transaction to create the post
  //   const tx = await program.methods.createPost(maxTitle, maxContent, maxPostId)
  //     .accounts({
  //       author: author.publicKey,
  //     })
  //     .rpc();

  //   console.log("CreatePost (Max Length) transaction signature", tx);

  //   // Fetch the post account
  //   const postAccount = await getPostAccount(maxPostPda);

  //   // Assertions
  //   assert.equal(postAccount.title, maxTitle, "Max title mismatch");
  //   assert.equal(postAccount.content, maxContent, "Max content mismatch");
  //   assert.equal(postAccount.commentCount, 0, "Initial comment count should be 0");

  //   // Cleanup: Delete the max post
  //   const deleteTx = await program.methods.deletePost()
  //     .accounts({
  //       post: maxPostPda,
  //       author: author.publicKey,
  //     })
  //     .rpc();

  //   console.log("DeletePost (Max Length) transaction signature", deleteTx);
  // });
});
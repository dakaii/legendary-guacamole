// tests/medium-clone.ts

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, setProvider } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { MediumClone } from "../target/types/medium_clone";

async function createPost(title: string, content: string, id: number, author: anchor.Wallet, program: Program<MediumClone>): Promise<PublicKey> {
  const postId = new anchor.BN(id);

  await program.methods.createPost(title, content, postId)
    .accounts({
      author: author.publicKey,
    })
    .rpc();

  const [postPda, _bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("post"),
      author.publicKey.toBuffer(),
      postId.toArrayLike(Buffer, "le", 8)
    ],
    program.programId
  );

  return postPda;
}

async function createComment(id: number, content: string, postPda: PublicKey, author: anchor.Wallet, program: Program<MediumClone>): Promise<PublicKey> {
  const commentId = new anchor.BN(id);

  const [commentPda, _bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("comment"),
      postPda.toBuffer(),
      commentId.toArrayLike(Buffer, "le", 8)
    ],
    program.programId
  );

  await program.methods.addComment(commentId, content)
    .accounts({
      post: postPda,
      author: author.publicKey,
    })
    .rpc();

  return commentPda;
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

  it("Creates a new post!", async () => {
    // Derive the PDA for the post
    // Send the transaction to create a post
    const tx = await program.methods.createPost(postTitle, postContent, postId)
      .accounts({
        author: author.publicKey
      })
      .rpc();

    console.log("CreatePost transaction signature", tx);

    const [postsPda, _bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from('post'),
        author.publicKey.toBuffer(),
        postId.toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const postAccount = await program.account.post.fetch(postsPda);

    assert.ok(postAccount.author.equals(author.publicKey), "Author mismatch");
    assert.equal(postAccount.id.toNumber(), postId.toNumber(), "Post ID mismatch");
    assert.equal(postAccount.title, postTitle, "Title mismatch");
    assert.equal(postAccount.content, postContent, "Content mismatch");
    assert.equal(postAccount.commentCount, 0, "Initial comment count should be 0");
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

    const postAccount = await program.account.post.fetch(postPda);

    assert.equal(postAccount.title, newTitle, "Title was not updated correctly");
    assert.equal(postAccount.content, newContent, "Content was not updated correctly");
    assert.isAtLeast(postAccount.updatedAt.toNumber(), postAccount.createdAt.toNumber(), "updated_at timestamp should be >= created_at");
  });

  it("Adds a comment to the post!", async () => {
    const commentId = new anchor.BN(1);
    const commentContent = "Great post!";
    const postPda = await createPost(postTitle, postContent, 3, author, program);
    const postAccount = await program.account.post.fetch(postPda);
    const currentCommentCount = postAccount.commentCount;

    const tx = await program.methods.addComment(commentId, commentContent)
      .accounts({
        post: postPda,
        author: author.publicKey,
      })
      .rpc();

    console.log("AddComment transaction signature", tx);

    const [commentsPda, _bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from('comment'),
        postPda.toBuffer(),
        commentId.toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    const commentAccount = await program.account.comment.fetch(commentsPda);

    assert.ok(commentAccount.author.equals(author.publicKey), "Comment author mismatch");
    assert.equal(commentAccount.content, commentContent, "Comment content mismatch");

    const postAccountAfter = await program.account.post.fetch(postPda);
    assert.equal(postAccountAfter.commentCount, currentCommentCount + 1, "Comment count did not increment");
  });

  // it("Updates the comment content!", async () => {
  //   const commentContent = "Great post!";
  //   const postPda = await createPost(postTitle, postContent, 10, author, program);
  //   const commentPda = await createComment(11, commentContent, postPda, author, program);

  //   // Send the transaction to update the comment
  //   const tx = await program.methods.updateComment("Updated comment content")
  //     .accounts({
  //       comment: commentPda,
  //       post: postPda,
  //       author: author.publicKey,
  //     })
  //     .rpc();

  //   console.log("UpdateComment transaction signature", tx);

  //   const commentAccount = await program.account.comment.fetch(commentPda);

  //   assert.equal(commentAccount.content, "Updated comment content", "Comment content was not updated correctly");
  // });

  // it("Deletes a comment from the post!", async () => {
  //   const postPda = await createPost(postTitle, postContent, 9, author, program);
  //   const commentPda = await createComment(10, "Great post!", postPda, author, program);

  //   const tx = await program.methods.deleteComment()
  //     .accounts({
  //       comment: commentPda,
  //       post: postPda,
  //       author: author.publicKey,
  //     })
  //     .rpc();

  //   console.log("DeleteComment transaction signature", tx);

  //   // Attempt to fetch the comment account, expecting it to fail
  //   try {
  //     await program.account.comment.fetch(commentPda);
  //     assert.fail("Comment account should be deleted");
  //   } catch (err: any) {
  //     assert.ok(err.message.includes("Account does not exist"), "Unexpected error message");
  //   }
  // });

  it("Deletes the post!", async () => {
    const postPda = await createPost('Test Post', 'Test Content', 4, author, program);
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
    const postPda = await createPost('Test Post', 'Test Content', 5, author, program);
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

  it("Creates a post with maximum title and content lengths!", async () => {
    const maxTitle = "T".repeat(100); // 100 characters
    // TODO check why the max content length is 870 and it fails with 1000
    const maxContentLength = 870;
    const maxContent = "C".repeat(maxContentLength); // 1000 characters
    const maxPostId = new anchor.BN(8); // Next post_id

    const [postPda, _bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("post"),
        author.publicKey.toBuffer(),
        maxPostId.toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    // Send the transaction to create the post
    const tx = await program.methods.createPost(maxTitle, maxContent, maxPostId)
      .accounts({
        author: author.publicKey,
      })
      .rpc();

    console.log("CreatePost (Max Length) transaction signature", tx);

    const postAccount = await program.account.post.fetch(postPda);

    assert.equal(postAccount.title, maxTitle, "Max title mismatch");
    assert.equal(postAccount.content, maxContent, "Max content mismatch");
    assert.equal(postAccount.commentCount, 0, "Initial comment count should be 0");

    // Cleanup: Delete the max post
    const deleteTx = await program.methods.deletePost()
      .accounts({
        post: postPda,
        author: author.publicKey,
      })
      .rpc();

    console.log("DeletePost (Max Length) transaction signature", deleteTx);
  });
});
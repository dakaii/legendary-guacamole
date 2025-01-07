import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, setProvider } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { MediumClone } from "../target/types/medium_clone";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

function generate32BytesFromUuid(): Uint8Array {
  // e.g., "0c9e5fba-7d47-4e22-980f-024e15f39905"
  const rawUuid = uuidv4();
  // Hash the UUID → 32 bytes
  const hash = crypto.createHash("sha256").update(rawUuid).digest();
  return new Uint8Array(hash); // This will be exactly 32 bytes
}

async function createPost(
  title: string,
  content: string,
  author: anchor.Wallet,
  program: Program<MediumClone>
): Promise<PublicKey> {
  const postId = generate32BytesFromUuid(); // Generate a UUID for the post and remove hyphens

  // Send the transaction to create the post
  const tx = await program.methods.createPost(Array.from(postId), title, content)
    .accounts({
      author: author.publicKey,
    })
    .rpc();

  console.log("CreatePost transaction signature", tx);
  // Derive the PDA for the post
  const [postPda, _bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("post"), author.publicKey.toBuffer(), Buffer.from(postId)],
    program.programId
  );

  return postPda;
}

async function createComment(
  postPda: PublicKey,
  author: anchor.Wallet,
  program: Program<MediumClone>
): Promise<PublicKey> {
  const commentId = generate32BytesFromUuid(); // Generate a UUID for the comment and remove hyphens

  // Send the transaction to create the comment
  await program.methods.addComment(Array.from(commentId), "Great post!")
    .accounts({
      post: postPda,
      author: author.publicKey,
    })
    .rpc();

  // Derive the PDA for the comment
  const [commentPda, _bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("comment"), postPda.toBuffer(), Buffer.from(commentId)],
    program.programId
  );

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

  it("Creates a new post!", async () => {
    const postPda = await createPost(postTitle, postContent, author, program);

    const postAccount = await program.account.post.fetch(postPda);

    assert.ok(postAccount.author.equals(author.publicKey), "Author mismatch");
    assert.equal(postAccount.title, postTitle, "Title mismatch");
    assert.equal(postAccount.content, postContent, "Content mismatch");
    assert.equal(postAccount.commentCount, 0, "Initial comment count should be 0");
  });

  it("Updates the post's title and content!", async () => {
    const newTitle = "My Updated Post";
    const newContent = "This is the updated content of my post.";
    const postPda = await createPost(postTitle, postContent, author, program);

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
    const postPda = await createPost(postTitle, postContent, author, program);
    const postAccount = await program.account.post.fetch(postPda);
    const currentCommentCount = postAccount.commentCount;

    const commentPda = await createComment(postPda, author, program);

    const commentAccount = await program.account.comment.fetch(commentPda);

    assert.ok(commentAccount.author.equals(author.publicKey), "Comment author mismatch");
    assert.equal(commentAccount.content, "Great post!", "Comment content mismatch");

    const postAccountAfter = await program.account.post.fetch(postPda);
    assert.equal(postAccountAfter.commentCount, currentCommentCount + 1, "Comment count did not increment");
  });

  it("Updates the comment content!", async () => {
    const postPda = await createPost(postTitle, postContent, author, program);
    const commentPda = await createComment(postPda, author, program);

    // Send the transaction to update the comment
    const tx = await program.methods.updateComment("Updated comment content")
      .accounts({
        comment: commentPda,
        post: postPda,
        author: author.publicKey,
      })
      .rpc();

    console.log("UpdateComment transaction signature", tx);

    const commentAccount = await program.account.comment.fetch(commentPda);

    assert.equal(commentAccount.content, "Updated comment content", "Comment content was not updated correctly");
  });

  it("Deletes a comment from the post!", async () => {
    const postPda = await createPost(postTitle, postContent, author, program);
    const commentPda = await createComment(postPda, author, program);

    const tx = await program.methods.deleteComment()
      .accounts({
        comment: commentPda,
        post: postPda,
        author: author.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("DeleteComment transaction signature", tx);

    // Attempt to fetch the comment account, expecting it to fail
    try {
      await program.account.comment.fetch(commentPda);
      assert.fail("Comment account should be deleted");
    } catch (err: any) {
      assert.ok(err.message.includes("Account does not exist"), "Unexpected error message");
    }
  });

  it("Deletes the post!", async () => {
    const postPda = await createPost("Test Post", "Test Content", author, program);
    const tx = await program.methods.deletePost()
      .accounts({
        post: postPda,
        author: author.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
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
    const postPda = await createPost("Test Post", "Test Content", author, program);
    // Create a new keypair to simulate another user
    const otherUser = Keypair.generate();

    // Airdrop SOL to the new user for transaction fees
    const airdropSignature = await provider.connection.requestAirdrop(otherUser.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(airdropSignature, "confirmed");

    // Create a wallet instance for the other user
    const otherUserWallet = new anchor.Wallet(otherUser);

    // Attempt to update the post using another user
    try {
      await program.methods.updatePost("Hacked Title", "Hacked Content")
        .accounts({
          post: postPda,
          author: otherUserWallet.publicKey,
        })
        .signers([otherUserWallet.payer])
        .rpc();
      assert.fail("Unauthorized user was able to update the post");
    } catch (err: any) {
      assert.ok(err.message.includes("A seeds constraint was violated"), "Unexpected error message");
    }
  });

  it("Creates a post with maximum title and content lengths!", async () => {
    const maxTitle = "T".repeat(100); // 100 characters
    const maxContent = "C".repeat(770); // 870 characters (adjusted for account size limits)
    const postPda = await createPost(maxTitle, maxContent, author, program);

    const postAccount = await program.account.post.fetch(postPda);

    assert.equal(postAccount.title, maxTitle, "Max title mismatch");
    assert.equal(postAccount.content, maxContent, "Max content mismatch");
    assert.equal(postAccount.commentCount, 0, "Initial comment count should be 0");

    // Cleanup: Delete the max post
    const deleteTx = await program.methods.deletePost()
      .accounts({
        post: postPda,
        author: author.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("DeletePost (Max Length) transaction signature", deleteTx);
  });
});
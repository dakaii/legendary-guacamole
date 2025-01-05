use anchor_lang::prelude::*;

declare_id!("EXint3MGu4oJkyYA96uQ1tw1RUBz9rpX2hXV71cGeGtA");

#[program]
pub mod medium_clone {
    use super::*;

    /// Creates a new post with a unique post_id.
    pub fn create_post(
        ctx: Context<CreatePost>,
        title: String,
        content: String,
        post_id: u64,
    ) -> Result<()> {
        let post = &mut ctx.accounts.post;
        post.author = *ctx.accounts.author.key;
        post.post_id = post_id;
        post.title = title;
        post.content = content;
        let clock = Clock::get()?;
        post.created_at = clock.unix_timestamp;
        post.updated_at = clock.unix_timestamp;
        post.comment_count = 0; // Initialize comment count
        Ok(())
    }

    /// Updates an existing post's title and content.
    pub fn update_post(ctx: Context<UpdatePost>, title: String, content: String) -> Result<()> {
        let post = &mut ctx.accounts.post;
        post.title = title; // Update title
        post.content = content; // Update content
        post.updated_at = Clock::get()?.unix_timestamp; // Update timestamp
        Ok(())
    }

    /// Deletes a post, automatically closing the account and refunding lamports to the author.
    pub fn delete_post(_ctx: Context<DeletePost>) -> Result<()> {
        // The account will be closed automatically, refunding lamports to the author
        Ok(())
    }

    /// Adds a comment to a post, initializing a new Comment account.
    pub fn add_comment(ctx: Context<AddComment>, content: String) -> Result<()> {
        let comment = &mut ctx.accounts.comment;
        comment.author = *ctx.accounts.author.key;
        comment.content = content;
        comment.created_at = Clock::get()?.unix_timestamp;
        ctx.accounts.post.comment_count += 1; // Increment comment count in the post

        Ok(())
    }
}

/// Represents a blog post.
#[account]
pub struct Post {
    pub author: Pubkey,     // 32 bytes: Public key of the post's author
    pub post_id: u64,       // 8 bytes: Unique identifier for the post
    pub title: String,      // 4 + 100 bytes: Title of the post
    pub content: String,    // 4 + 1000 bytes: Content of the post
    pub created_at: i64,    // 8 bytes: Timestamp when the post was created
    pub updated_at: i64,    // 8 bytes: Timestamp when the post was last updated
    pub comment_count: u32, // 4 bytes: Number of comments on the post
}

/// Represents a comment on a blog post.
#[account]
pub struct Comment {
    pub author: Pubkey,  // 32 bytes: Public key of the comment's author
    pub content: String, // 4 + 500 bytes: Content of the comment
    pub created_at: i64, // 8 bytes: Timestamp when the comment was created
}

/// Context for creating a new post.
#[derive(Accounts)]
#[instruction(title: String, content: String, post_id: u64)]
pub struct CreatePost<'info> {
    #[account(
        init,                                                 // Initializes a new Post account
        payer = author,                                       // `author` pays for the account creation
        space = 8 + 32 + 8 + 4 + 100 + 4 + 1000 + 8 + 8 + 4, // Total space for Post account
        seeds = [b"post", author.key().as_ref(), post_id.to_le_bytes().as_ref()],
        bump
    )]
    pub post: Account<'info, Post>, // The Post account to be created
    #[account(mut)]
    pub author: Signer<'info>, // The author signing the transaction
    pub system_program: Program<'info, System>, // System program required for account creation
}

/// Context for updating an existing post.
#[derive(Accounts)]
#[instruction(post_id: u64)]
pub struct UpdatePost<'info> {
    #[account(
        mut,
        seeds = [b"post", author.key().as_ref(), post_id.to_le_bytes().as_ref()],
        bump,
        has_one = author
    )]
    pub post: Account<'info, Post>, // The Post account to be updated
    pub author: Signer<'info>, // The author signing the transaction
}

/// Context for deleting a post.
#[derive(Accounts)]
#[instruction(post_id: u64)]
pub struct DeletePost<'info> {
    #[account(
        mut,
        seeds = [b"post", author.key().as_ref(), post_id.to_le_bytes().as_ref()],
        bump,
        has_one = author,
        close = author
    )]
    pub post: Account<'info, Post>, // The Post account to be deleted
    pub author: Signer<'info>, // The author signing the transaction
}

/// Context for adding a comment to a post.
#[derive(Accounts)]
#[instruction(content: String)]
pub struct AddComment<'info> {
    #[account(
        init,                                                 // Initializes a new Comment account
        payer = author,                                       // `author` pays for the account creation
        space = 8 + 32 + 4 + 500 + 8,                        // Total space for Comment account
        seeds = [b"comment", post.key().as_ref(), &get_comment_count(&post)],
        bump
    )]
    pub comment: Account<'info, Comment>, // The Comment account to be created
    #[account(mut)]
    pub post: Account<'info, Post>, // The Post account to which the comment is added
    #[account(mut)]
    pub author: Signer<'info>, // The author signing the transaction
    pub system_program: Program<'info, System>, // System program required for account creation
}

/// Helper function to retrieve comment count as bytes.
fn get_comment_count(post: &Post) -> [u8; 4] {
    post.comment_count.to_le_bytes() // Converts `comment_count` (u32) to little-endian byte array
}
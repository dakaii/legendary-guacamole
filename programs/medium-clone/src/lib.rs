use anchor_lang::prelude::*;

declare_id!("BPrjbxBWnwyBjAvFWejSVCvTmppqHqN8mdfD1Rwy4Pcf");

#[program]
pub mod twitter_clone {

    use super::*;

    pub fn create_post(
        ctx: Context<CreatePost>,
        id: [u8; 32],
        title: String,
        content: String,
    ) -> Result<()> {
        if title.len() > 100 {
            return Err(ErrorCode::ExceedsMaxLength.into());
        }
        if content.len() > 1000 {
            return Err(ErrorCode::ExceedsMaxLength.into());
        }
        let post = &mut ctx.accounts.post;
        post.id = id;
        post.author = *ctx.accounts.author.key;
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
        if post.author != *ctx.accounts.author.key {
            return Err(ErrorCode::AuthorMismatch.into());
        }
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
    pub fn add_comment(ctx: Context<AddComment>, id: [u8; 32], content: String) -> Result<()> {
        let comment = &mut ctx.accounts.comment;
        comment.id = id;
        comment.post_id = ctx.accounts.post.key();
        comment.author = *ctx.accounts.author.key;
        comment.content = content;
        let clock = Clock::get()?;
        comment.created_at = clock.unix_timestamp;
        comment.updated_at = clock.unix_timestamp;
        ctx.accounts.post.comment_count += 1; // Increment comment count in the post

        Ok(())
    }

    pub fn update_comment(ctx: Context<UpdateComment>, content: String) -> Result<()> {
        let comment = &mut ctx.accounts.comment;
        if comment.author != *ctx.accounts.author.key {
            return Err(ErrorCode::AuthorMismatch.into());
        }
        comment.content = content;
        comment.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn delete_comment(ctx: Context<DeleteComment>) -> Result<()> {
        // Optionally decrement the comment_count on the post
        let post = &mut ctx.accounts.post;
        post.comment_count = post.comment_count.saturating_sub(1);

        // The comment account is automatically closed and lamports refunded
        // to `author` (via `close = author`).
        Ok(())
    }
}

/// Represents a blog post.
#[account]
pub struct Post {
    pub author: Pubkey,     // 32 bytes: Public key of the post's author
    pub id: [u8; 32],       // 32 bytes: Unique identifier for the post
    pub title: String, // 4 + 100 bytes = 104 bytes (String length prefix + title string): Title of the post
    pub content: String, // 4 + 500 bytes = 1004 bytes (String length prefix + content string): Content of the post
    pub created_at: i64, // 8 bytes: Timestamp when the post was created
    pub updated_at: i64, // 8 bytes: Timestamp when the post was last updated
    pub comment_count: u32, // 4 bytes: Number of comments on the post
}

/// Represents a comment on a blog post.
#[account]
pub struct Comment {
    pub author: Pubkey,  // 32 bytes: Public key of the comment's author
    pub post_id: Pubkey, // 32 bytes: Public key of the post to which the comment belongs
    pub id: [u8; 32],    // 32 bytes: Unique identifier for the comment
    pub content: String, // 4 + 300 bytes = 504 bytes (String length prefix + content string): Content of the comment
    pub created_at: i64, // 8 bytes: Timestamp when the comment was created
    pub updated_at: i64, // 8 bytes: Timestamp when the comment was last updated
}

/// Context for creating a new post.
#[derive(Accounts)]
#[instruction(id: [u8; 32], title: String, content: String)]
pub struct CreatePost<'info> {
    #[account(
        init,                                                 // Initializes a new Post account
        payer = author,                                       // `author` pays for the account creation
        space = 8 + 32 + 32 + 4 + 100 + 4 + 500 + 8 + 8 + 4, // Total space for Post account
        seeds = [b"post", author.key().as_ref(), id.as_ref()],
        bump
    )]
    pub post: Account<'info, Post>, // The Post account to be created
    #[account(mut)]
    pub author: Signer<'info>, // The author signing the transaction
    pub system_program: Program<'info, System>, // System program required for account creation
}

/// Context for updating an existing post.
#[derive(Accounts)]
#[instruction(title: String, content: String)]
pub struct UpdatePost<'info> {
    #[account(
        mut,
        seeds = [b"post", author.key().as_ref(), post.id.as_ref()], // this needs to match the seed used during account creation (pretty fucking obvious, i guess.)
        bump,
        has_one = author
    )]
    pub post: Account<'info, Post>, // The Post account to be updated
    // no need to add #[account(mut)] for `author` as it is not being modified
    pub author: Signer<'info>, // The author signing the transaction
                               // no need to pass `system_program` here as we are not creating or closing any new accounts
}

/// Context for deleting a post.
#[derive(Accounts)]
pub struct DeletePost<'info> {
    #[account(
        mut,
        seeds = [b"post", author.key().as_ref(), post.id.as_ref()], // this needs to match the seed used during account creation
        bump,
        has_one = author,
        close = author
    )]
    pub post: Account<'info, Post>, // The Post account to be deleted
    // no need to add #[account(mut)] for `author` as it is not being modified
    pub author: Signer<'info>, // The author signing the transaction
    pub system_program: Program<'info, System>,
}

/// Context for adding a comment to a post.
#[derive(Accounts)]
#[instruction(id: [u8; 32], content: String)]
pub struct AddComment<'info> {
    #[account(
        init,                                                 // Initializes a new Comment account
        payer = author,                                       // `author` pays for the account creation
        space = 8 + 32 + 32 + 32 + 4 + 300 + 8 + 8,             // Total space for Comment account
        seeds = [b"comment", post.key().as_ref(), id.as_ref()],
        bump
    )]
    pub comment: Account<'info, Comment>, // The Comment account to be created
    #[account(mut)]
    pub post: Account<'info, Post>, // The Post account to which the comment is added
    #[account(mut)]
    pub author: Signer<'info>, // The author signing the transaction
    pub system_program: Program<'info, System>, // System program required for account creation
}

#[derive(Accounts)]
#[instruction(content: String)]
pub struct UpdateComment<'info> {
    #[account(
        mut,
        seeds = [b"comment", post.key().as_ref(), comment.id.as_ref()],
        bump,
        has_one = author
    )]
    pub comment: Account<'info, Comment>,
    #[account(mut)]
    pub post: Account<'info, Post>,
    pub author: Signer<'info>,
    // Not creating or closing an account, so `system_program` is not mandatory
}

#[derive(Accounts)]
pub struct DeleteComment<'info> {
    // We pass in the Post so that the seeds can reference it for the Comment account
    #[account(
        mut,
        seeds = [b"comment", post.key().as_ref(), comment.id.as_ref()],
        bump,
        has_one = author,
        close = author
    )]
    pub comment: Account<'info, Comment>,
    #[account(mut)]
    pub post: Account<'info, Post>,
    pub author: Signer<'info>,
    // Needed because we are closing an account
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Title or content exceeds maximum length")]
    ExceedsMaxLength,
    #[msg("Author mismatch")]
    AuthorMismatch,
}

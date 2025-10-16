// New ACP implementation using the official agent-client-protocol library
// This is a complete rewrite built from scratch

mod client;
pub mod manager;

pub use client::ThinkingSpaceClient;
pub use manager::AcpManager;

#![forbid(unsafe_code)]
#![warn(clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

pub mod config;
pub mod health;
pub mod paths;
pub mod process;

pub use config::Settings;
pub use health::{is_healthy, wait_healthy};
pub use process::{start, NodeHandle};
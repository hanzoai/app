use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub host: String,
    pub api_port: u16,
    pub ws_port: u16,
    pub node_port: u16,
    pub https_port: u16,
    pub storage_path: PathBuf,
    pub no_secret_file: bool,
    pub first_device_needs_registration: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            api_port: 3690,
            ws_port: 3691,
            node_port: 3692,
            https_port: 3693,
            storage_path: PathBuf::from("./node_storage"),
            no_secret_file: true,
            first_device_needs_registration: false,
        }
    }
}

impl Settings {
    pub fn api_address(&self) -> String {
        format!("{}:{}", self.host, self.api_port)
    }

    pub fn ws_address(&self) -> String {
        format!("{}:{}", self.host, self.ws_port)
    }
}
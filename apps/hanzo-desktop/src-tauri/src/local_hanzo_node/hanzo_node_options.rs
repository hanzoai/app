use std::path::PathBuf;

use crate::hardware::{hardware_get_summary, RequirementsStatus};
use serde::{Deserialize, Serialize};

/// It matches ENV variables names from HanzoNode
#[derive(Serialize, Deserialize, Clone)]
pub struct HanzoNodeOptions {
    pub node_api_ip: Option<String>,
    pub node_api_port: Option<String>,
    pub node_ws_port: Option<String>,
    pub node_https_port: Option<String>,
    pub node_ip: Option<String>,
    pub node_port: Option<String>,
    pub global_identity_name: Option<String>,
    pub node_storage_path: Option<String>,
    pub embeddings_server_url: Option<String>,
    pub first_device_needs_registration_code: Option<String>,
    pub initial_agent_names: Option<String>,
    pub initial_agent_urls: Option<String>,
    pub initial_agent_models: Option<String>,
    pub initial_agent_api_keys: Option<String>,
    pub starting_num_qr_devices: Option<String>,
    pub log_all: Option<String>,
    pub proxy_identity: Option<String>,
    pub rpc_url: Option<String>,
    pub default_embedding_model: Option<String>,
    pub supported_embedding_models: Option<String>,
    pub hanzo_tools_runner_deno_binary_path: Option<String>,
    pub hanzo_tools_runner_uv_binary_path: Option<String>,
    pub hanzo_store_url: Option<String>,
    pub secret_desktop_installation_proof_key: Option<String>,
}

impl HanzoNodeOptions {
    pub fn with_app_options(app_resource_dir: PathBuf, app_data_dir: PathBuf) -> HanzoNodeOptions {
        let default_node_storage_path = app_data_dir
            .join("node_storage")
            .to_string_lossy()
            .to_string();
        log::debug!("Node storage path: {:?}", default_node_storage_path);
        HanzoNodeOptions {
            node_storage_path: Some(default_node_storage_path),
            ..Default::default()
        }
    }

    pub fn default_initial_model() -> String {
        "hanzo-backend:FREE_TEXT_INFERENCE".to_string()
    }

    pub fn from_merge(
        base_options: HanzoNodeOptions,
        options: HanzoNodeOptions,
    ) -> HanzoNodeOptions {
        let default_options = HanzoNodeOptions::default();
        HanzoNodeOptions {
            node_api_ip: Some(
                options
                    .node_api_ip
                    .or(base_options.node_api_ip)
                    .unwrap_or_default(),
            ),
            node_api_port: Some(
                options
                    .node_api_port
                    .or(base_options.node_api_port)
                    .unwrap_or_default(),
            ),
            node_ws_port: Some(
                options
                    .node_ws_port
                    .or(base_options.node_ws_port)
                    .unwrap_or_default(),
            ),
            node_ip: Some(options.node_ip.or(base_options.node_ip).unwrap_or_default()),
            node_port: Some(
                options
                    .node_port
                    .or(base_options.node_port)
                    .unwrap_or_default(),
            ),
            node_https_port: Some(
                options
                    .node_https_port
                    .or(base_options.node_https_port)
                    .unwrap_or_default(),
            ),
            global_identity_name: Some(
                options
                    .global_identity_name
                    .or(base_options.global_identity_name)
                    .unwrap_or_else(|| "hanzod".to_string()),
            ),
            node_storage_path: Some(
                options
                    .node_storage_path
                    .or(base_options.node_storage_path)
                    .unwrap_or_default(),
            ),
            embeddings_server_url: Some(
                options
                    .embeddings_server_url
                    .or(base_options.embeddings_server_url)
                    .unwrap_or_default(),
            ),
            first_device_needs_registration_code: Some(
                options
                    .first_device_needs_registration_code
                    .or(base_options.first_device_needs_registration_code)
                    .unwrap_or_default(),
            ),
            initial_agent_names: Some(
                options
                    .initial_agent_names
                    .or(base_options.initial_agent_names)
                    .unwrap_or_default(),
            ),
            initial_agent_urls: Some(
                options
                    .initial_agent_urls
                    .or(base_options.initial_agent_urls)
                    .unwrap_or_default(),
            ),
            initial_agent_models: Some(
                options
                    .initial_agent_models
                    .or(base_options.initial_agent_models)
                    .unwrap_or_default(),
            ),
            initial_agent_api_keys: Some(
                options
                    .initial_agent_api_keys
                    .or(base_options.initial_agent_api_keys)
                    .unwrap_or_default(),
            ),
            starting_num_qr_devices: Some(
                options
                    .starting_num_qr_devices
                    .or(base_options.starting_num_qr_devices)
                    .unwrap_or_default(),
            ),
            log_all: Some(options.log_all.or(base_options.log_all).unwrap_or_default()),
            rpc_url: Some(options.rpc_url.or(base_options.rpc_url).unwrap_or_default()),
            default_embedding_model: Some(
                options
                    .default_embedding_model
                    .or(base_options.default_embedding_model)
                    .unwrap_or_default(),
            ),
            supported_embedding_models: Some(
                options
                    .supported_embedding_models
                    .or(base_options.supported_embedding_models)
                    .unwrap_or_default(),
            ),
            hanzo_tools_runner_deno_binary_path: Some(
                options
                    .hanzo_tools_runner_deno_binary_path
                    .or(base_options.hanzo_tools_runner_deno_binary_path)
                    .unwrap_or_default(),
            ),
            hanzo_tools_runner_uv_binary_path: Some(
                options
                    .hanzo_tools_runner_uv_binary_path
                    .or(base_options.hanzo_tools_runner_uv_binary_path)
                    .unwrap_or_default(),
            ),
            hanzo_store_url: Some(
                options
                    .hanzo_store_url
                    .or(base_options.hanzo_store_url)
                    .unwrap_or_default(),
            ),
            secret_desktop_installation_proof_key: default_options
                .secret_desktop_installation_proof_key,
            proxy_identity: default_options.proxy_identity,
        }
    }
}
impl Default for HanzoNodeOptions {
    fn default() -> HanzoNodeOptions {
        let hanzo_tools_runner_deno_binary_path = std::env::current_exe()
            .unwrap()
            .parent()
            .unwrap()
            .join(if cfg!(target_os = "windows") {
                "deno.exe"
            } else {
                "deno"
            })
            .to_string_lossy()
            .to_string();

        let hanzo_tools_runner_uv_binary_path = std::env::current_exe()
            .unwrap()
            .parent()
            .unwrap()
            .join(if cfg!(target_os = "windows") {
                "uv.exe"
            } else {
                "uv"
            })
            .to_string_lossy()
            .to_string();

        HanzoNodeOptions {
            node_api_ip: Some("127.0.0.1".to_string()),
            node_api_port: Some("3690".to_string()),
            node_ws_port: Some("3691".to_string()),
            node_ip: Some("127.0.0.1".to_string()),
            node_port: Some("3692".to_string()),
            node_https_port: Some("3693".to_string()),
            global_identity_name: Some("hanzod".to_string()),
            node_storage_path: Some("./".to_string()),
            embeddings_server_url: Some("http://127.0.0.1:11435".to_string()),
            first_device_needs_registration_code: Some("false".to_string()),
            initial_agent_urls: Some(
                "https://api.hanzo.com/inference,https://api.hanzo.com/inference".to_string(),
            ),
            initial_agent_names: Some("hanzo-free-trial,hanzo-code-gen".to_string()),
            initial_agent_models: Some(
                "hanzo-backend:FREE_TEXT_INFERENCE,hanzo-backend:CODE_GENERATOR".to_string(),
            ),
            initial_agent_api_keys: Some(" , ".to_string()), // Two empty API keys with space to ensure proper parsing
            starting_num_qr_devices: Some("0".to_string()),
            log_all: Some("1".to_string()),
            proxy_identity: Some("libp2p_relayer.sep-hanzo".to_string()),
            rpc_url: Some("https://sepolia.base.org".to_string()),
            default_embedding_model: Some("snowflake-arctic-embed:xs".to_string()),
            supported_embedding_models: Some("snowflake-arctic-embed:xs".to_string()),
            hanzo_tools_runner_deno_binary_path: Some(hanzo_tools_runner_deno_binary_path),
            hanzo_tools_runner_uv_binary_path: Some(hanzo_tools_runner_uv_binary_path),
            hanzo_store_url: Some("https://store-api.hanzo.com".to_string()),
            secret_desktop_installation_proof_key: option_env!(
                "SECRET_DESKTOP_INSTALLATION_PROOF_KEY"
            )
            .and_then(|s| Some(s.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proxy_identity_no_invalid_chars() {
        // Test that proxy_identity doesn't contain invalid characters like @@
        let options = HanzoNodeOptions::default();

        // Check proxy_identity is set
        assert!(options.proxy_identity.is_some());

        let proxy_id = options.proxy_identity.unwrap();

        // Ensure no @@ prefix (which was causing the crash)
        assert!(
            !proxy_id.starts_with("@@"),
            "proxy_identity should not start with @@, got: {}",
            proxy_id
        );

        // Ensure it has the correct value
        assert_eq!(
            proxy_id, "libp2p_relayer.sep-hanzo",
            "proxy_identity should be 'libp2p_relayer.sep-hanzo', got: {}",
            proxy_id
        );

        // Check for any invalid characters that would cause node to fail
        assert!(
            !proxy_id.contains("@@"),
            "proxy_identity should not contain @@ anywhere, got: {}",
            proxy_id
        );
    }

    #[test]
    fn test_port_configuration() {
        // Test that ports are configured correctly (3690, 3691, 3692, 3693)
        let options = HanzoNodeOptions::default();

        assert_eq!(
            options.node_api_port,
            Some("3690".to_string()),
            "API port should be 3690"
        );

        assert_eq!(
            options.node_ws_port,
            Some("3691".to_string()),
            "WebSocket port should be 3691"
        );

        assert_eq!(
            options.node_port,
            Some("3692".to_string()),
            "Node port should be 3692"
        );

        assert_eq!(
            options.node_https_port,
            Some("3693".to_string()),
            "HTTPS port should be 3693"
        );
    }

    #[test]
    fn test_global_identity_name_valid() {
        // Test that global_identity_name is set and valid
        let options = HanzoNodeOptions::default();

        // Check global_identity_name is set
        assert!(
            options.global_identity_name.is_some(),
            "global_identity_name should be set"
        );

        let global_id = options.global_identity_name.unwrap();

        // Ensure it's not empty
        assert!(
            !global_id.is_empty(),
            "global_identity_name should not be empty"
        );

        // Ensure no @@ prefix
        assert!(
            !global_id.starts_with("@@"),
            "global_identity_name should not start with @@, got: {}",
            global_id
        );

        // Ensure it has the correct value
        assert_eq!(
            global_id, "hanzod",
            "global_identity_name should be 'hanzod', got: {}",
            global_id
        );
    }

    #[test]
    fn test_merge_preserves_valid_proxy_identity() {
        // Test that merging options preserves the valid proxy_identity
        let base = HanzoNodeOptions::default();
        let override_opts = HanzoNodeOptions {
            node_api_port: Some("9999".to_string()),
            ..Default::default()
        };

        let merged = HanzoNodeOptions::from_merge(base, override_opts);

        // proxy_identity should remain valid after merge
        assert_eq!(
            merged.proxy_identity,
            Some("libp2p_relayer.sep-hanzo".to_string()),
            "Merged options should preserve valid proxy_identity"
        );

        // API port should be overridden
        assert_eq!(
            merged.node_api_port,
            Some("9999".to_string()),
            "API port should be overridden in merge"
        );
    }

    #[test]
    fn test_with_app_options() {
        // Test that app options are properly set
        let app_resource_dir = PathBuf::from("/test/resource");
        let app_data_dir = PathBuf::from("/test/data");

        let options = HanzoNodeOptions::with_app_options(app_resource_dir, app_data_dir.clone());

        // Check node_storage_path is set correctly
        let expected_storage = app_data_dir
            .join("node_storage")
            .to_string_lossy()
            .to_string();
        assert_eq!(
            options.node_storage_path,
            Some(expected_storage),
            "node_storage_path should be set to app_data_dir/node_storage"
        );
    }

    #[test]
    fn test_initial_agents_configuration() {
        // Test that initial agents are configured correctly
        let options = HanzoNodeOptions::default();

        assert!(options.initial_agent_urls.is_some());
        assert!(options.initial_agent_names.is_some());
        assert!(options.initial_agent_models.is_some());

        // Check URLs point to hanzo.com
        let urls = options.initial_agent_urls.unwrap();
        assert!(
            urls.contains("hanzo.com"),
            "Agent URLs should point to hanzo.com, got: {}",
            urls
        );

        // Check agent names contain hanzo
        let names = options.initial_agent_names.unwrap();
        assert!(
            names.contains("hanzo"),
            "Agent names should contain 'hanzo', got: {}",
            names
        );
    }
}

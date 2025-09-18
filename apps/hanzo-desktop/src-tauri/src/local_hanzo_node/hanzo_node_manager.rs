use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use super::ollama_api::ollama_api_client::OllamaApiClient;
use super::ollama_api::ollama_api_types::OllamaApiPullResponse;
use super::process_handlers::hanzo_node_process_handler::HanzoNodeProcessHandler;
use super::process_handlers::ollama_process_handler::OllamaProcessHandler;
use crate::local_hanzo_node::hanzo_node_options::HanzoNodeOptions;
use crate::models::embedding_model;
use anyhow::Result;
use futures_util::StreamExt;
use log::error;
use serde::{Deserialize, Serialize};
use tauri::path::BaseDirectory;
use tauri::AppHandle;
use tauri::Manager;
use tokio::sync::broadcast;
use tokio::sync::mpsc::channel;

#[derive(Serialize, Deserialize, Clone)]
pub enum HanzoNodeManagerEvent {
    StartingHanzoNode,
    HanzoNodeStarted,
    HanzoNodeStartError { error: String },

    StartingOllama,
    OllamaStarted,
    OllamaStartError { error: String },

    PullingModelStart { model: String },
    PullingModelProgress { model: String, progress: u32 },
    PullingModelDone { model: String },
    PullingModelError { model: String, error: String },

    CreatingModelStart { model: String },
    CreatingModelProgress { model: String, progress: u32 },
    CreatingModelDone { model: String },
    CreatingModelError { model: String, error: String },

    StoppingHanzoNode,
    HanzoNodeStopped,
    HanzoNodeStopError { error: String },

    StoppingOllama,
    OllamaStopped,
    OllamaStopError { error: String },
}

pub struct HanzoNodeManager {
    ollama_process: OllamaProcessHandler,
    hanzo_node_process: HanzoNodeProcessHandler,
    event_broadcaster: broadcast::Sender<HanzoNodeManagerEvent>,
    app_resource_dir: PathBuf,
    llm_models_path: PathBuf,
}

impl HanzoNodeManager {
    pub(crate) fn new(app: AppHandle, app_resource_dir: PathBuf, app_data_dir: PathBuf) -> Self {
        let (ollama_sender, _ollama_receiver) = channel(100);
        let (hanzo_node_sender, _hanzo_node_receiver) = channel(100);
        let (event_broadcaster, _) = broadcast::channel(10);
        let llm_models_path = app
            .path()
            .resolve("llm-models", BaseDirectory::Resource)
            .unwrap();
        HanzoNodeManager {
            ollama_process: OllamaProcessHandler::new(
                app.clone(),
                ollama_sender,
                app_resource_dir.clone(),
            ),
            hanzo_node_process: HanzoNodeProcessHandler::new(
                app,
                hanzo_node_sender,
                app_resource_dir.clone(),
                app_data_dir,
            ),
            event_broadcaster,
            app_resource_dir,
            llm_models_path,
        }
    }

    pub async fn get_hanzo_node_options(&self) -> HanzoNodeOptions {
        let options = self.hanzo_node_process.get_options();
        options.clone()
    }

    pub async fn is_running(&self) -> bool {
        // Prefer external node if available
        if self
            .check_external_node("127.0.0.1", 3690, Duration::from_millis(500))
            .await
        {
            return true;
        }

        // Otherwise, check managed process (only hanzod)
        self.hanzo_node_process.is_running().await
    }

    pub async fn spawn(&mut self) -> Result<(), String> {
        log::info!("NodeManager::spawn() called");

        // Check if node is already running externally
        log::info!("Checking for existing node service on port 3690");
        // Allow a generous timeout to avoid false negatives on slower systems
        let check_timeout = Duration::from_millis(1000);

        if self.check_external_node("127.0.0.1", 3690, check_timeout).await {
            log::info!("Found existing node service, using it instead of spawning new instance");
            return Ok(());
        }

        log::info!("No external node found, checking if our managed instance is running...");
        if self.hanzo_node_process.is_running().await {
            log::info!("Already running our managed instance, returning early");
            return Ok(());
        }

        // Skip Ollama startup - only start hanzod
        log::info!("Starting Hanzo Node process...");
        self.emit_event(HanzoNodeManagerEvent::StartingHanzoNode);
        match self.hanzo_node_process.spawn().await {
            Ok(_) => {
                log::info!("Hanzo Node started successfully");
                self.emit_event(HanzoNodeManagerEvent::HanzoNodeStarted);
            }
            Err(e) => {
                log::error!("Failed to start Hanzo Node: {}", e);
                self.kill().await;
                self.emit_event(HanzoNodeManagerEvent::HanzoNodeStartError { error: e.clone() });
                return Err(e);
            }
        }
        Ok(())
    }

    pub async fn kill(&mut self) {
        self.emit_event(HanzoNodeManagerEvent::StoppingHanzoNode);
        self.hanzo_node_process.kill().await;
        self.emit_event(HanzoNodeManagerEvent::HanzoNodeStopped);
        self.emit_event(HanzoNodeManagerEvent::StoppingOllama);
        self.ollama_process.kill().await;
        self.emit_event(HanzoNodeManagerEvent::OllamaStopped);
    }

    pub async fn remove_storage(&self, preserve_keys: bool) -> Result<(), String> {
        self.hanzo_node_process.remove_storage(preserve_keys).await
    }

    pub fn get_storage_path(&self) -> PathBuf {
        self.hanzo_node_process.get_storage_path()
    }

    pub fn open_storage_location(&self) -> Result<(), String> {
        self.hanzo_node_process.open_storage_location()
    }

    pub fn open_storage_location_with_path(&self, relative_path: &str) -> Result<(), String> {
        self.hanzo_node_process
            .open_storage_location_with_path(relative_path)
    }

    pub fn open_chat_folder(
        &self,
        storage_location: &str,
        chat_folder_name: &str,
    ) -> Result<(), String> {
        self.hanzo_node_process
            .open_chat_folder(storage_location, chat_folder_name)
    }

    pub async fn set_default_hanzo_node_options(&mut self) -> HanzoNodeOptions {
        self.hanzo_node_process.set_default_options()
    }

    pub async fn set_hanzo_node_options(&mut self, options: HanzoNodeOptions) -> HanzoNodeOptions {
        self.hanzo_node_process.set_options(options)
    }

    fn emit_event(&mut self, new_event: HanzoNodeManagerEvent) {
        let _ = self.event_broadcaster.send(new_event);
    }

    pub fn subscribe_to_events(
        &mut self,
    ) -> tokio::sync::broadcast::Receiver<HanzoNodeManagerEvent> {
        self.event_broadcaster.subscribe()
    }

    /// Check if node is already running externally
    async fn check_external_node(&self, host: &str, port: u16, timeout: Duration) -> bool {
        let client = reqwest::Client::new();
        let url = format!("http://{}:{}/v2/health_check", host, port);

        log::debug!("Checking external node at {} (timeout: {}ms)", url, timeout.as_millis());

        match tokio::time::timeout(timeout, client.get(&url).send()).await {
            Ok(Ok(response)) if response.status().is_success() => {
                log::info!("External node service detected at {}:{}", host, port);
                true
            }
            Ok(Ok(response)) => {
                log::debug!("Health check returned status: {}", response.status());
                false
            }
            Ok(Err(e)) => {
                log::debug!("Health check failed: {}", e);
                false
            }
            Err(_) => {
                log::debug!("Health check timed out");
                false
            }
        }
    }

    pub fn get_ollama_api_url(&self) -> String {
        self.ollama_process.get_ollama_api_base_url()
    }

    pub async fn get_ollama_version(app: AppHandle) -> Result<String> {
        OllamaProcessHandler::version(app).await
    }
}

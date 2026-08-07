use crate::core::app::commands::get_jan_data_folder_path;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::OnceLock,
    time::Instant,
};
use tauri::{AppHandle, Runtime};
use tokio::{process::Command, sync::Mutex};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

static JOBS: OnceLock<Mutex<HashMap<String, CancellationToken>>> = OnceLock::new();

fn jobs() -> &'static Mutex<HashMap<String, CancellationToken>> {
    JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateImageRequest {
    pub job_id: String,
    pub model: String,
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub steps: Option<u32>,
    pub guidance_scale: Option<f32>,
    pub seed: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateImageResult {
    pub job_id: String,
    pub path: PathBuf,
    pub width: u32,
    pub height: u32,
    pub seed: i64,
    pub duration_ms: u128,
}

fn validate_request(request: &GenerateImageRequest) -> Result<(u32, u32, u32, f32, i64), String> {
    if request.prompt.trim().is_empty() || request.prompt.chars().count() > 8_000 {
        return Err("Prompt must contain between 1 and 8000 characters".into());
    }
    let width = request.width.unwrap_or(1024);
    let height = request.height.unwrap_or(1024);
    if !(256..=2048).contains(&width)
        || !(256..=2048).contains(&height)
        || width % 64 != 0
        || height % 64 != 0
    {
        return Err("Image dimensions must be multiples of 64 between 256 and 2048".into());
    }
    let steps = request.steps.unwrap_or(20);
    if !(1..=100).contains(&steps) {
        return Err("Steps must be between 1 and 100".into());
    }
    let guidance = request.guidance_scale.unwrap_or(7.0);
    if !(0.0..=30.0).contains(&guidance) {
        return Err("Guidance scale must be between 0 and 30".into());
    }
    Ok((width, height, steps, guidance, request.seed.unwrap_or(-1)))
}

fn canonical_child(path: &Path, root: &Path, label: &str) -> Result<PathBuf, String> {
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("{label} is unavailable: {e}"))?;
    let canonical_root = root
        .canonicalize()
        .map_err(|e| format!("Image generation root is unavailable: {e}"))?;
    if !canonical.starts_with(&canonical_root) {
        return Err(format!(
            "{label} must be installed under Atomic Chat's image-generation directory"
        ));
    }
    Ok(canonical)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageModel {
    pub id: String,
    pub path: PathBuf,
    pub family: &'static str,
}

fn image_root<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    get_jan_data_folder_path(app.clone()).join("image-generation")
}

#[tauri::command]
pub fn list_image_models<R: Runtime>(app: AppHandle<R>) -> Result<Vec<ImageModel>, String> {
    let models = image_root(&app).join("models");
    std::fs::create_dir_all(&models).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for entry in std::fs::read_dir(models).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        let supported = path.extension().and_then(|e| e.to_str()).is_some_and(|e| {
            matches!(
                e.to_ascii_lowercase().as_str(),
                "safetensors" | "ckpt" | "gguf"
            )
        });
        if supported {
            let id = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or_default()
                .to_string();
            result.push(ImageModel {
                id,
                path,
                family: "sdxl",
            });
        }
    }
    result.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(result)
}

fn resolve_runtime(root: &Path) -> Result<PathBuf, String> {
    let names: &[&str] = if cfg!(windows) {
        &["sd-cli.exe", "sd-cli"]
    } else {
        &["sd-cli"]
    };
    names
        .iter()
        .map(|name| root.join("backends").join(name))
        .find(|path| path.is_file())
        .ok_or_else(|| "The Atomic Image runtime is not installed".to_string())
}

#[tauri::command]
pub async fn generate_image<R: Runtime>(
    app: AppHandle<R>,
    request: GenerateImageRequest,
) -> Result<GenerateImageResult, String> {
    let (width, height, steps, guidance, seed) = validate_request(&request)?;
    let root = image_root(&app);
    std::fs::create_dir_all(root.join("generated")).map_err(|e| e.to_string())?;
    let runtime = canonical_child(&resolve_runtime(&root)?, &root, "Image runtime")?;
    if request.model.contains('/') || request.model.contains('\\') || request.model.contains("..") {
        return Err("Invalid image model id".into());
    }
    let model = canonical_child(
        &root.join("models").join(&request.model),
        &root,
        "Image model",
    )?;
    let output = root
        .join("generated")
        .join(format!("{}.png", Uuid::new_v4()));
    let temporary_output = root
        .join("generated")
        .join(format!(".{}.partial.png", request.job_id));
    let token = CancellationToken::new();
    jobs()
        .lock()
        .await
        .insert(request.job_id.clone(), token.clone());

    let started = Instant::now();
    let mut command = Command::new(runtime);
    command
        .kill_on_drop(true)
        .arg("--mode")
        .arg("img_gen")
        .arg("--model")
        .arg(model)
        .arg("--prompt")
        .arg(&request.prompt)
        .arg("--negative-prompt")
        .arg(request.negative_prompt.as_deref().unwrap_or(""))
        .arg("--width")
        .arg(width.to_string())
        .arg("--height")
        .arg(height.to_string())
        .arg("--steps")
        .arg(steps.to_string())
        .arg("--cfg-scale")
        .arg(guidance.to_string())
        .arg("--seed")
        .arg(seed.to_string())
        .arg("--output")
        .arg(&temporary_output);
    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to start image runtime: {e}"))?;
    let status = tokio::select! {
        status = child.wait() => status.map_err(|e| format!("Image runtime failed: {e}"))?,
        _ = token.cancelled() => {
            let _ = child.kill().await;
            let _ = std::fs::remove_file(&temporary_output);
            jobs().lock().await.remove(&request.job_id);
            return Err("Image generation cancelled".into());
        }
    };
    jobs().lock().await.remove(&request.job_id);
    if !status.success() {
        let _ = std::fs::remove_file(&temporary_output);
        return Err(format!("Image runtime exited with {status}"));
    }
    if !temporary_output.is_file() {
        return Err("Image runtime completed without producing an output file".into());
    }
    std::fs::rename(&temporary_output, &output)
        .map_err(|e| format!("Failed to commit generated image: {e}"))?;
    Ok(GenerateImageResult {
        job_id: request.job_id,
        path: output,
        width,
        height,
        seed,
        duration_ms: started.elapsed().as_millis(),
    })
}

#[tauri::command]
pub async fn cancel_image_generation(job_id: String) -> Result<(), String> {
    let token = jobs().lock().await.get(&job_id).cloned();
    if let Some(token) = token {
        token.cancel();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn request() -> GenerateImageRequest {
        GenerateImageRequest {
            job_id: "job".into(),
            model: "model.safetensors".into(),
            prompt: "cat".into(),
            negative_prompt: None,
            width: None,
            height: None,
            steps: None,
            guidance_scale: None,
            seed: None,
        }
    }
    #[test]
    fn validates_sdxl_defaults() {
        assert_eq!(
            validate_request(&request()).unwrap(),
            (1024, 1024, 20, 7.0, -1)
        );
    }
    #[test]
    fn rejects_unaligned_dimensions() {
        let mut r = request();
        r.width = Some(1000);
        assert!(validate_request(&r).is_err());
    }
    #[test]
    fn rejects_empty_prompt() {
        let mut r = request();
        r.prompt = " ".into();
        assert!(validate_request(&r).is_err());
    }
}

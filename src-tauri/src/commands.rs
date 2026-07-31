use crate::{hitokoto, AppState};
use tauri::{command, Manager, State};

/// 获取单个配置值
#[command]
pub fn get_config_value(state: State<AppState>, key: String) -> Option<String> {
    let db = state.db.lock().unwrap();
    db.get_config(&key)
}

/// 设置单个配置值
#[command]
pub fn set_config_value(state: State<AppState>, key: String, value: String) {
    let db = state.db.lock().unwrap();
    let _ = db.set_config(&key, &value);
}

/// 获取所有配置
#[command]
pub fn get_all_config(state: State<AppState>) -> Vec<(String, String)> {
    let db = state.db.lock().unwrap();
    db.get_all_config().unwrap_or_default()
}

/// 获取一言（先调 API 再操作 DB，避免跨 await 持锁）
#[command]
pub async fn fetch_hitokoto(
    state: State<'_, AppState>,
    category: Option<String>,
) -> Result<String, String> {
    let cat = category.unwrap_or_else(|| "all".to_string());

    let mut quote = hitokoto::fetch_from_api(&cat).await;

    for _ in 0..3 {
        // 在独立作用域内操作 DB，离开后锁自动释放
        let cached = {
            let db = state.db.lock().unwrap();
            db.is_hitokoto_cached(&quote)
        };
        if !cached {
            let db = state.db.lock().unwrap();
            let _ = db.add_hitokoto_cache(&quote);
            let _ = db.cleanup_hitokoto_cache();
            break;
        }
        // 锁已释放，安全 await
        quote = hitokoto::fetch_from_api(&cat).await;
    }

    Ok(quote)
}

/// LLM 生成兜底发言
#[command]
pub async fn generate_llm_speeches(
    endpoint: String,
    api_key: String,
    model: String,
) -> Result<Vec<String>, String> {
    crate::llm::generate_speeches(&endpoint, &api_key, &model).await
}

/// 保存宠物窗口位置
#[command]
pub fn save_pet_position(state: State<AppState>, x: i32, y: i32) {
    let db = state.db.lock().unwrap();
    let _ = db.set_config(crate::KEY_POSITION_X, &x.to_string());
    let _ = db.set_config(crate::KEY_POSITION_Y, &y.to_string());
}

/// 切换鼠标穿透
#[command]
pub async fn set_click_through(
    app: tauri::AppHandle,
    enable: bool,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("pet") {
        window
            .set_ignore_cursor_events(enable)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 设置 Dock 图标可见性（macOS，运行时即时生效 + 持久化）
#[command]
pub fn set_dock_visible(
    app: tauri::AppHandle,
    state: State<AppState>,
    visible: bool,
) -> Result<(), String> {
    // 持久化到数据库
    {
        let db = state.db.lock().unwrap();
        let _ = db.set_config(crate::KEY_HIDE_DOCK, &(!visible).to_string());
    }
    #[cfg(target_os = "macos")]
    {
        use tauri::ActivationPolicy;
        let policy = if visible {
            ActivationPolicy::Regular
        } else {
            ActivationPolicy::Accessory
        };
        let _ = app.set_activation_policy(policy);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, visible);
    Ok(())
}

/// 获取当前平台
#[command]
pub fn get_platform() -> String {
    #[cfg(target_os = "macos")]
    { "macos".to_string() }
    #[cfg(target_os = "windows")]
    { "windows".to_string() }
    #[cfg(target_os = "linux")]
    { "linux".to_string() }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    { "unknown".to_string() }
}

/// 打开调试台
#[command]
pub fn open_devtools(app: tauri::AppHandle) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("pet") {
        window.open_devtools();
    }
}

/// 在指定窗口中执行一段 JavaScript（用于跨窗口更新内容，例如气泡文本）
#[command]
pub fn eval_in_window(app: tauri::AppHandle, label: String, code: String) -> Result<(), String> {
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("window '{}' not found", label))?;
    window.eval(&code).map_err(|e| e.to_string())
}

mod commands;
mod db;
mod hitokoto;
mod llm;
mod tray;

use db::Database;
use log::{error, info};
use std::sync::Mutex;
use tauri::Manager;

/// 全局数据库实例
struct AppState {
    db: Mutex<Database>,
}

/// 宠物配置键名（仅位置相关被后端使用，其余由前端 localStorage 管理）
const KEY_POSITION_X: &str = "position_x";
const KEY_POSITION_Y: &str = "position_y";
const KEY_HIDE_DOCK: &str = "hide_dock_icon";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_millis()
        .init();

    info!("伴星 CompanionPet v0.1.0 启动中...");

    let db = Database::new().expect("数据库初始化失败");
    info!("SQLite 数据库初始化完成");

    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--quiet"]),
        ))
        .manage(AppState {
            db: Mutex::new(db),
        })
        .setup(|app| {
            info!("Tauri setup 开始");

            // 初始化系统托盘
            match tray::create_tray(app.handle()) {
                Ok(_) => info!("系统托盘创建成功"),
                Err(e) => error!("系统托盘创建失败: {}", e),
            }

            // 恢复宠物窗口位置（默认右下角）
            let state = app.state::<AppState>();
            let db = state.db.lock().unwrap();

            let x_str = db.get_config(KEY_POSITION_X);
            let y_str = db.get_config(KEY_POSITION_Y);
            info!("数据库中的位置: x={:?}, y={:?}", x_str, y_str);
            // 读取 Dock 隐藏设置
            let hide_dock = db.get_config(KEY_HIDE_DOCK)
                .map(|v| v == "true")
                .unwrap_or(false);
            drop(db);

            // 初始化 Dock 图标可见性
            if hide_dock {
                #[cfg(target_os = "macos")]
                {
                    use tauri::ActivationPolicy;
                    app.set_activation_policy(ActivationPolicy::Accessory);
                    info!("Dock 图标已隐藏 (ActivationPolicy::Accessory)");
                }
            }

            let default_x: i32 = 1000;
            let default_y: i32 = 600;

            // 获取可用显示器信息，计算默认位置（屏幕右下角内侧）并校验保存的位置
            let monitors = app.available_monitors().unwrap_or_default();
            let primary = monitors.first();

            info!("检测到 {} 个显示器", monitors.len());
            let (dx, dy) = if let Some(monitor) = primary {
                let size = monitor.size();
                let pos = monitor.position();
                let scale = monitor.scale_factor();
                info!("主显示器: 物理位置({},{}), 物理尺寸{}x{}, scale={}", pos.x, pos.y, size.width, size.height, scale);
                // pet 窗口逻辑尺寸 128（贴近 PNG），对应物理尺寸 128×scale；放右下角内侧留 24px 边距
                let pet_size_phys = (128.0 * scale) as i32;
                (
                    pos.x as i32 + size.width as i32 - pet_size_phys - 24,
                    pos.y as i32 + size.height as i32 - pet_size_phys - 24,
                )
            } else {
                (default_x, default_y)
            };

            info!("计算默认位置(右下角内侧): dx={}, dy={}", dx, dy);

            let x: i32 = x_str.as_ref().and_then(|s| s.parse().ok()).unwrap_or(dx);
            let y: i32 = y_str.as_ref().and_then(|s| s.parse().ok()).unwrap_or(dy);

            info!("恢复位置: 数据库({:?}, {:?}) -> 解析后({}, {})", x_str, y_str, x, y);

            // 校验窗口位置是否落在任一可用屏幕内；若超出则回退到默认位置
            let within_any_monitor = monitors.iter().any(|m| {
                let size = m.size();
                let pos = m.position();
                x >= pos.x
                    && y >= pos.y
                    && x <= pos.x + size.width as i32 - 40
                    && y <= pos.y + size.height as i32 - 40
            });

            let (final_x, final_y) = if within_any_monitor {
                info!("位置({}, {}) 在屏幕范围内, 直接使用", x, y);
                (x, y)
            } else {
                error!(
                    "保存的窗口位置({}, {}) 不在任何可用屏幕内，回退到默认位置({}, {})",
                    x, y, dx, dy
                );
                (dx, dy)
            };

            info!("最终窗口位置: x={}, y={}", final_x, final_y);

            if let Some(window) = app.get_webview_window("pet") {
                // 检查并输出窗口初始属性
                let is_visible = window.is_visible().unwrap_or(false);
                let is_top = window.is_always_on_top().unwrap_or(false);
                info!("窗口初始状态: visible={}, always_on_top={}", is_visible, is_top);

                if let Err(e) = window.set_position(tauri::PhysicalPosition::new(final_x, final_y)) {
                    error!("设置宠物窗口位置失败: {}", e);
                }
                // 透明无边框窗口在 macOS 上有时需要显式 show + focus 才能呈现
                if let Err(e) = window.show() {
                    error!("显示宠物窗口失败: {}", e);
                }
                if let Err(e) = window.set_focus() {
                    error!("聚焦宠物窗口失败: {}", e);
                }
                if let Err(e) = window.set_always_on_top(true) {
                    error!("设置置顶失败: {}", e);
                } else {
                    info!("全局置顶已设置");
                }

                // 再次确认当前状态
                let final_visible = window.is_visible().unwrap_or(false);
                let final_top = window.is_always_on_top().unwrap_or(false);
                info!("窗口最终状态: visible={}, always_on_top={}", final_visible, final_top);
            } else {
                error!("未找到 pet 窗口!");
            }

            info!("Tauri setup 完成");
            Ok(())
        })
        .on_window_event(|_window, event| {
            use tauri::WindowEvent;
            match event {
                WindowEvent::Resized(size) => info!("[pet] 窗口大小变化: {}x{}", size.width, size.height),
                WindowEvent::Moved(position) => info!("[pet] 窗口移动: x={}, y={}", position.x, position.y),
                WindowEvent::Focused(focused) => info!("[pet] 窗口焦点: {}", focused),
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config_value,
            commands::set_config_value,
            commands::get_all_config,
            commands::fetch_hitokoto,
            commands::generate_llm_speeches,
            commands::save_pet_position,
            commands::set_click_through,
            commands::set_dock_visible,
            commands::get_platform,
            commands::open_devtools,
            commands::eval_in_window,
        ])
        .run(tauri::generate_context!())
        .expect("启动应用失败");
}

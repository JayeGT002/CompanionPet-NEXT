use log::{error, info};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show_item = MenuItemBuilder::with_id("show", "显示 / 隐藏").build(app)?;
    let settings_item = MenuItemBuilder::with_id("settings", "设置").build(app)?;
    let devtools_item = MenuItemBuilder::with_id("devtools", "打开调试台").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .item(&settings_item)
        .item(&devtools_item)
        .separator()
        .item(&quit_item)
        .build()?;

    let mut builder = TrayIconBuilder::new().menu(&menu);

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    } else {
        error!("未找到应用托盘图标，将继续创建托盘（无图标）");
    }

    let _tray = builder
        .tooltip("伴星 CompanionPet")
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("pet") {
                        if window.is_visible().unwrap_or(false) {
                            info!("托盘: 隐藏宠物窗口");
                            let _ = window.hide();
                        } else {
                            info!("托盘: 显示宠物窗口");
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        let visible = window.is_visible().unwrap_or(false);
                        let label = if visible { "✓ 显示 / 隐藏" } else { "  显示 / 隐藏" };
                        let _ = show_item.set_text(label);
                    }
                }
                "settings" => {
                    // 直接复用预创建的 settings 窗口：已可见则隐藏，否则显示并聚焦
                    match app.get_webview_window("settings") {
                        Some(sw) => {
                            if sw.is_visible().unwrap_or(false) {
                                info!("托盘: 隐藏设置窗口");
                                let _ = sw.hide();
                            } else {
                                info!("托盘: 显示设置窗口");
                                let _ = sw.show();
                                let _ = sw.set_focus();
                            }
                        }
                        None => error!("托盘: 未找到 settings 窗口"),
                    }
                }
                "devtools" => {
                    if let Some(window) = app.get_webview_window("pet") {
                        info!("托盘: 打开调试台");
                        window.open_devtools();
                    }
                }
                "quit" => {
                    info!("托盘: 退出应用");
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("pet") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem,
};

fn build_tray() -> SystemTray {
    let open     = CustomMenuItem::new("open".to_string(),  "Open MyChat");
    let quit     = CustomMenuItem::new("quit".to_string(),  "Quit");
    let separator = SystemTrayMenuItem::Separator;

    let menu = SystemTrayMenu::new()
        .add_item(open)
        .add_native_item(separator)
        .add_item(quit);

    SystemTray::new().with_menu(menu)
}

fn main() {
    tauri::Builder::default()
        .system_tray(build_tray())
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                let window = app.get_window("main").unwrap();
                if window.is_visible().unwrap_or(false) {
                    window.hide().unwrap();
                } else {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "open" => {
                    let window = app.get_window("main").unwrap();
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
                "quit" => std::process::exit(0),
                _ => {}
            },
            _ => {}
        })
        .on_window_event(|event| {
            // Hide to tray instead of closing
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                event.window().hide().unwrap();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running MyChat desktop app");
}

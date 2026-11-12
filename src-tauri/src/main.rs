// Release builds must not attach a console window: without this attribute the
// Windows binary is a console app, so launching it shows a terminal alongside
// the Tauri window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    omp_ctl_lib::run();
}

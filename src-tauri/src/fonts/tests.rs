use std::fs;

use super::*;

struct Sandbox {
    _guard: std::sync::MutexGuard<'static, ()>,
    root: PathBuf,
}

impl Sandbox {
    fn new(tag: &str) -> Sandbox {
        let guard = crate::SANDBOX_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let root = std::env::temp_dir().join(format!(
            "omp-ctl-fonts-{tag}-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        std::env::set_var("HOME", &root);
        Sandbox {
            _guard: guard,
            root,
        }
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

#[test]
fn imports_lists_and_removes() {
    let sb = Sandbox::new("basic");
    let src = sb.root.join("My Font.ttf");
    fs::write(&src, b"font-bytes").unwrap();

    let imported = import(&src).unwrap();
    assert_eq!(imported.family, "My Font");
    assert_eq!(imported.size, 10);
    assert!(imported.path.starts_with(sb.root.join(".omp-ctl").join("fonts")));

    let listed = list().unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].family, "My Font");

    assert!(remove("My Font").unwrap());
    assert!(list().unwrap().is_empty());
    assert!(!remove("My Font").unwrap());
}

#[test]
fn rejects_unsupported_extension() {
    let sb = Sandbox::new("reject");
    let src = sb.root.join("notes.txt");
    fs::write(&src, b"x").unwrap();
    let err = import(&src).unwrap_err();
    assert!(err.to_string().contains("unsupported font format"), "{err}");
}

#[test]
fn reimport_overwrites_same_family() {
    let sb = Sandbox::new("overwrite");
    let src = sb.root.join("Chill.woff2");
    fs::write(&src, b"v1").unwrap();
    import(&src).unwrap();
    fs::write(&src, b"version-two").unwrap();
    let again = import(&src).unwrap();
    assert_eq!(again.size, 11);
    assert_eq!(list().unwrap().len(), 1);
}

#[test]
fn missing_font_dir_lists_empty() {
    let _sb = Sandbox::new("empty");
    assert!(list().unwrap().is_empty());
}

#[test]
fn reads_imported_bytes() {
    let sb = Sandbox::new("read");
    let src = sb.root.join("Readable.otf");
    fs::write(&src, b"otf-bytes").unwrap();
    import(&src).unwrap();
    assert_eq!(read("Readable").unwrap(), b"otf-bytes");
    let err = read("Missing").unwrap_err();
    assert!(err.to_string().contains("is not imported"), "{err}");
}

default:
    @just --list

# Enter the Nix development shell.
develop:
    nix develop

# Check the Nix flake.
check:
    nix flake check

# Update flake inputs.
update:
    nix flake update

# Show flake outputs.
show:
    nix flake show

# Format Nix files.
fmt:
    nix fmt

# Type-check the Rust backend.
check-rust:
    cargo check --manifest-path src-tauri/Cargo.toml

# Run Rust tests.
test:
    cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture

# Format Rust sources.
fmt-rust:
    cargo fmt

# Install frontend dependencies.
web-install:
    cd web && bun install

# Type-check the frontend.
web-check:
    cd web && bun run check

# Build the frontend into dist/.
web-build:
    cd web && bun run build

# Serve the frontend on the port Tauri expects.
serve:
    cd web && bun run dev

# Wayland 下 WebKit 渲染错乱，需禁用 DMABUF renderer 并走 X11。
dev:
    WEBKIT_DISABLE_DMABUF_RENDERER=1 GDK_BACKEND=x11 cargo tauri dev

# Build a release bundle.
build: web-build
    cargo tauri build

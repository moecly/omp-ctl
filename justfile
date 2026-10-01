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

# Serve the static frontend on the port Tauri expects.
serve:
    python3 -m http.server 1420 --bind 127.0.0.1 --directory dist

# Launch the GUI in dev mode (run `just serve` in another terminal first).
dev:
    cargo tauri dev

# Build a release bundle.
build:
    cargo tauri build

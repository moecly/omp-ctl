{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      rust-overlay,
    }:
    let
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];
      forAllSystems =
        f:
        nixpkgs.lib.genAttrs systems (
          system:
          f (
            (import nixpkgs {
              inherit system;
              overlays = [ rust-overlay.overlays.default ];
            })
          )
        );
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            just

            (rust-bin.stable.latest.default.override {
              extensions = [ "rust-src" ];
            })
            cargo-tauri
            bun

            pkg-config
            gtk3
            webkitgtk_4_1
            libsoup_3
            openssl
            glib-networking
            librsvg
          ];

          env = {
            RUST_BACKTRACE = "1";
          };
        };
      });

      formatter = forAllSystems (pkgs: pkgs.nixfmt-rfc-style);
    };
}

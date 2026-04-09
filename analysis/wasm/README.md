# Flow Runtime WASM Build

## Prerequisites

- Install Emscripten and make `emcc` available on `PATH`.
- Run commands from the repository root in Windows PowerShell.

## Commands

Build browser artifacts:

```powershell
powershell -ExecutionPolicy Bypass -File analysis/wasm/build-runtime.ps1 -Target browser
```

Generate the block catalog:

```powershell
powershell -ExecutionPolicy Bypass -File analysis/wasm/build-runtime.ps1 -Target catalog
```

Build everything:

```powershell
powershell -ExecutionPolicy Bypass -File analysis/wasm/build-runtime.ps1 -Target end-to-end
```

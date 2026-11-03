# Security policy

## What this project runs

DSH Cinema is a local rendering tool. It does not contact a network service, ship credentials, or phone home. It:

- launches a **local Chrome** through `puppeteer-core` and loads `studio.html` from `file://`;
- reads and writes files inside the project directory (`src/`, `out/`, `assets/`, `audio/`);
- spawns the **local `ffmpeg`** binary to encode frames and mux audio;
- renders into a canvas using only the code in `template/src/`.

There is no remote code execution surface beyond the template you are editing: `template/src/**` is executed in the page,
so treat a third-party shim or asset added to `src/` exactly as you would treat code run on your machine.

## Supported versions

| version | supported |
|---|---|
| 1.x | yes |

## Reporting a vulnerability

Open a private security advisory on GitHub (`Security → Report a vulnerability`) or email the maintainers listed in
`package.json`. Please do not open a public issue for a vulnerability in the renderer or the installers.

Include: the DSH Cinema version, the operating system, a minimal reproduction (a shot file is usually enough) and what an
attacker could achieve. We aim to acknowledge within 7 days.

## Things that are not vulnerabilities

- A film that renders badly, slowly, or not at all because of a bad shot file. Use `scripts/scan.mjs` and open an issue.
- The local Chrome sandbox being disabled by a user's own flags.
- The `--chrome=<path>` flag pointing at a browser the user chose.

## Installer behaviour

`scripts/install.ps1` and `scripts/update.ps1`:

- install into `$env:DSH_HOME\skills\dsh-cinema` (or `~/.dsh/skills/dsh-cinema` by default);
- never modify files outside that directory;
- back up an existing install to `skills\.backup\dsh-cinema-<timestamp>` before replacing it;
- do not download anything except the repository itself when you pass `-Repo`;
- refuse to run if the destination exists and `-Force` was not given.
